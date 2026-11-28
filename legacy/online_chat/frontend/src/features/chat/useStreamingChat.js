// 1. THƯ VIỆN NỀN TẢNG (Trạng thái transcript và bộ điều khiển stream)
import { useState, useRef } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Giao thức SSE)
import { streamChatApi } from '../../shared/api/chatApi';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Quản lý gửi, dừng và xóa tin nhắn với cùng vòng đời phiên chat hiện tại. */
export function useStreamingChat({ currentProject }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const abortControllerRef = useRef(null);

  /**
   * Xử lý gửi tin nhắn của người dùng và kích hoạt luồng SSE.
   *
   * @param {string} [customPrompt] Nội dung câu hỏi truyền từ chip gợi ý (tùy chọn).
   */
  const handleSendMessage = async (customPrompt) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || isStreaming) return;

    setInputText('');
    setErrorMessage(null);

    // 1. Đưa tin nhắn của user vào danh sách và tạo sẵn một tin nhắn bot rỗng
    const newHistory = [
      ...messages,
      { role: 'user', content: textToSend }
    ];
    setMessages([...newHistory, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    // 2. Khởi tạo AbortController cho luồng SSE mới
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 3. Gọi luồng SSE với cấu hình Chatbox mặc định từ máy chủ.

    await streamChatApi({
      messages: newHistory,
      projectId: currentProject?.id || null,
      provider: null,
      signal: controller.signal,
      onChunk: (chunkText) => {
        setMessages((prev) => {
          if (!prev.length) return prev;
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex].role === 'assistant') {
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: updated[lastIndex].content + chunkText
            };
          }
          return updated;
        });
      },
      onError: (errMsg) => {
        setErrorMessage(errMsg);
        setIsStreaming(false);
      },
      onDone: () => {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    });
  };

  /**
   * Hủy luồng phát sinh câu trả lời ngay lập tức khi người dùng bấm Dừng.
   */
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  /**
   * Xóa sạch toàn bộ lịch sử tin nhắn trong phiên chat.
   */
  const handleClearChat = () => {
    if (isStreaming) handleStopStreaming();
    setMessages([]);
    setErrorMessage(null);
  };

  return { messages, inputText, isStreaming, errorMessage, setErrorMessage, setInputText, handleSendMessage, handleStopStreaming, handleClearChat };
}
