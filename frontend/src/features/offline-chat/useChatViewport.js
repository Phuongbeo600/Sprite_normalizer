// 1. THƯ VIỆN NỀN TẢNG REACT (Vị trí cuộn và theo dõi tin mới)
import { useEffect, useRef, useState } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Không sử dụng)

// 4. CẤU HÌNH (Khoảng cách nhận biết người đọc đang ở cuối)
const BOTTOM_THRESHOLD = 64;

/**
 * Chỉ theo dõi token mới khi người đọc ở gần cuối hội thoại.
 * @param {Object} props Trạng thái hội thoại và cửa sổ đang hiển thị.
 * @returns {Object} Ref vùng cuộn, nút xuống cuối và các hàm điều khiển.
 */
export function useChatViewport({ messages, activeSessionId, isOpen, historyLoading }) {
  const messagesRef = useRef(null);
  const followingRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    followingRef.current = true;
    setShowScrollButton(false);
  }, [activeSessionId]);

  useEffect(() => {
    const element = messagesRef.current;
    if (isOpen && !historyLoading && followingRef.current && element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, isOpen, historyLoading]);

  useEffect(() => {
    const element = messagesRef.current;
    const content = element?.firstElementChild;
    if (!isOpen || historyLoading || !content || typeof ResizeObserver === 'undefined') return;
    // Markdown tải lười, ảnh và đổi kích thước cửa sổ có thể thay chiều cao mà không đổi messages.
    const observer = new ResizeObserver(() => {
      if (followingRef.current) {
        element.scrollTop = element.scrollHeight;
      } else {
        setShowScrollButton(element.scrollHeight - element.scrollTop - element.clientHeight > BOTTOM_THRESHOLD);
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [isOpen, historyLoading]);

  /** Ghi nhận ý định đọc lịch sử thay vì ép cuộn khi có token mới. */
  const handleScroll = () => {
    const element = messagesRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_THRESHOLD;
    followingRef.current = nearBottom;
    setShowScrollButton(!nearBottom);
  };

  /** Bật lại theo dõi tin mới khi người dùng chủ động xuống cuối hoặc gửi câu hỏi. */
  const scrollToBottom = () => {
    followingRef.current = true;
    setShowScrollButton(false);
    const element = messagesRef.current;
    element?.scrollTo({ top: element.scrollHeight, behavior: 'auto' });
  };

  return { messagesRef, showScrollButton, handleScroll, scrollToBottom };
}
