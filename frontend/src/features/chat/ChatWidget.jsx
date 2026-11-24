// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useRef, useEffect } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ biểu tượng vector SVG cho giao diện Chatbot
import {
  Bot,
  X,
  Send,
  Square,
  Trash2,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Maximize2,
  Minimize2
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (API & Components)
// ========================================================
// streamChatApi: Hàm gọi endpoint SSE phát luồng thời gian thực
import { useStreamingChat } from './useStreamingChat';
// getProjectApiConfig: Đọc cấu hình model chat của dự án
import { getProjectApiConfig } from '../../shared/api/projectApiConfig';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC (Stylesheets)
// ========================================================
import './chat.css';

/**
 * Danh sách câu hỏi gợi ý nhanh ban đầu giúp người dùng khám phá tính năng.
 */
const QUICK_SUGGESTIONS = [
  'Căn lề Bottom-Center và tìm hõm cổ neck_y có tác dụng gì?',
  'Hướng dẫn viết prompt ma trận Walk Cycle 15 frame.',
  'Làm sao để xuất và nhập sprite vào Godot Engine 4?'
];

/**
 * Hộp thoại Trợ lý AI Chatbot dạng Floating Widget phản hồi thời gian thực qua SSE.
 * Tự động hỗ trợ đa nhà cung cấp (Google Gemini, OpenAI, DeepSeek, Ollama).
 *
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object|null} props.currentProject Dự án hiện tại đang mở (nếu có).
 * @returns {React.ReactElement} Giao diện bong bóng chat và cửa sổ trò chuyện.
 */
export default function ChatWidget({ currentProject }) {
  const { messages, inputText, isStreaming, selectedProvider, errorMessage, setErrorMessage, setInputText, setSelectedProvider, handleSendMessage, handleStopStreaming, handleClearChat } = useStreamingChat({ currentProject });

  // Trạng thái mở/đóng cửa sổ chat
  const [isOpen, setIsOpen] = useState(false);
  // Mô hình chat thực tế được cấu hình trong dự án
  const [activeChatModel, setActiveChatModel] = useState('');

  // Tự động tải tên model chat đang được cấu hình cho dự án khi mở khung chat
  useEffect(() => {
    if (currentProject?.id && isOpen) {
      getProjectApiConfig(currentProject.id)
        .then((res) => (res.ok ? res.json() : null))
        .then((resJson) => {
          if (resJson?.data?.chat_model) {
            setActiveChatModel(resJson.data.chat_model);
          } else {
            setActiveChatModel('');
          }
        })
        .catch(() => {});
    }
  }, [currentProject?.id, isOpen]);
  // Danh sách lịch sử tin nhắn trong phiên làm việc
  // Nội dung ô nhập liệu
  // Cờ báo hiệu AI đang phát luồng câu trả lời
  // Trạng thái kích thước mở rộng to (chiếm gần nửa màn hình nhưng không che hết)
  const [isExpanded, setIsExpanded] = useState(true);
  // Lựa chọn nhà cung cấp AI ('auto' | 'gemini' | 'openai') - Mặc định 'auto' ưu tiên Cài đặt dự án
  // Thông báo lỗi nếu xảy ra sự cố kết nối

  // Tham chiếu DOM tới đáy khung chat để tự động cuộn
  const messagesEndRef = useRef(null);
  // Tham chiếu tới AbortController để hủy luồng khi cần
  // Tham chiếu ô input để tự động focus
  const inputRef = useRef(null);

  // Tự động cuộn xuống dưới cùng khi có chữ mới hoặc tin nhắn mới
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Tự động focus vào ô nhập liệu khi mở cửa sổ chat
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <>
      {/* Nút bong bóng chat nổi ở góc màn hình */}
      {!isOpen && (
        <button
          className="chat-widget-fab"
          onClick={() => setIsOpen(true)}
          title="Mở Trợ lý AI Chatbot"
        >
          <div className="chat-fab-dot" />
          <Bot size={18} />
          <span>Trợ Lý AI</span>
        </button>
      )}

      {/* Cửa sổ Chatbot dạng nổi (hỗ trợ chế độ mở to không che hết màn hình) */}
      {isOpen && (
        <div className={`chat-widget-window ${isExpanded ? 'expanded' : ''}`}>
          {/* Thanh tiêu đề Header */}
          <div className="chat-header">
            <div className="chat-header-title">
              <div className="chat-avatar-mini bot">
                <Bot size={16} />
              </div>
              <div>
                <h4>Trợ Lý Studio</h4>
                <span>
                  <Sparkles size={11} color="var(--accent-purple)" />
                  {activeChatModel ? `Model: ${activeChatModel}` : 'Phản hồi thời gian thực'}
                </span>
              </div>
            </div>

            <div className="chat-header-actions">
              {/* Lựa chọn nhà cung cấp AI */}
              <select
                className="chat-header-select"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                disabled={isStreaming}
                title="Chọn nhà cung cấp AI"
              >
                <option value="auto">⚡ Cài đặt dự án</option>
                <option value="openai">OpenAI / DeepSeek</option>
                <option value="gemini">Google Gemini</option>
              </select>

              {/* Nút phóng to / thu nhỏ khung chat */}
              <button
                className="chat-icon-btn"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Thu nhỏ kích thước" : "Mở rộng kích thước"}
              >
                {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>

              {/* Nút dọn dẹp tin nhắn */}
              <button
                className="chat-icon-btn"
                onClick={handleClearChat}
                title="Xóa cuộc trò chuyện"
                disabled={messages.length === 0}
              >
                <Trash2 size={15} />
              </button>

              {/* Nút đóng cửa sổ chat */}
              <button
                className="chat-icon-btn"
                onClick={() => setIsOpen(false)}
                title="Đóng cửa sổ"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Vùng tin nhắn hiển thị */}
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <div className="chat-empty-icon">
                  <MessageSquare size={22} />
                </div>
                <h5>Xin chào! Tôi có thể giúp gì cho bạn?</h5>
                <p>
                  Tôi là trợ lý AI chuyên về chuẩn hóa đồ họa Pixel Art, ma trận hoạt họa và tài nguyên Godot Engine 4.
                </p>

                {/* Các chip câu hỏi gợi ý */}
                <div className="chat-suggestion-chips">
                  {QUICK_SUGGESTIONS.map((suggestion, index) => (
                    <button
                      key={index}
                      className="chat-chip"
                      onClick={() => handleSendMessage(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`chat-message-row ${msg.role}`}>
                  <div className={`chat-avatar-mini ${msg.role === 'user' ? 'user' : 'bot'}`}>
                    {msg.role === 'user' ? 'U' : <Bot size={15} />}
                  </div>
                  <div className={`chat-bubble ${msg.role}`}>
                    {msg.content}
                    {/* Hiển thị con trỏ nhấp nháy nếu là tin nhắn cuối của bot đang stream */}
                    {isStreaming && index === messages.length - 1 && msg.role === 'assistant' && (
                      <span className="chat-cursor" />
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Khung thông báo lỗi nếu có */}
          {errorMessage && (
            <div className="chat-error-toast">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={14} />
                {errorMessage}
              </span>
              <button
                className="chat-icon-btn"
                style={{ width: 20, height: 20 }}
                onClick={() => setErrorMessage(null)}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Thanh nhập liệu ở cuối */}
          <div className="chat-input-bar">
            <input
              ref={inputRef}
              type="text"
              className="chat-input-field"
              placeholder="Nhập câu hỏi của bạn..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isStreaming}
            />

            {isStreaming ? (
              <button
                className="chat-stop-btn"
                onClick={handleStopStreaming}
                title="Dừng phản hồi"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                className="chat-send-btn"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim()}
                title="Gửi tin nhắn"
              >
                <Send size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
