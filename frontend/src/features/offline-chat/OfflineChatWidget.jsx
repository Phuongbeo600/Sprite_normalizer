// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý đóng/mở cửa sổ, phóng to & cuộn)
// ========================================================
import React, { useEffect, useRef, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng FAB Trợ Lý AI, điều khiển model, chỉ mục và nguồn tham chiếu
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  Cpu,
  Database,
  FileText,
  History,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  Send,
  Sliders,
  Square,
  X,
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Hook RAG Offline, Ngăn kéo Lịch sử/Thông số & Câu hỏi mẫu)
// ========================================================
import { OFFLINE_CHAT_SUGGESTIONS } from '../../constants/offlineChatSamples';
import OfflineHistoryDrawer from './OfflineHistoryDrawer';
import OfflineInspectorDrawer, { OfflineModelStatusPill } from './OfflineInspectorDrawer';
import { useOfflineChat } from './useOfflineChat';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
import './offline-chat.css';

/**
 * Cửa sổ nổi Trợ Lý AI dùng hoàn toàn Chatbot RAG Offline (Qwen3.5-4B & BGE-M3).
 * Giữ nguyên mọi tính năng kiểm soát RAM, đồng bộ chỉ mục, trích dẫn nguồn và hủy stream SSE.
 *
 * @returns {React.ReactElement} Nút bong bóng Trợ Lý AI và cửa sổ nổi RAG Offline.
 */
export default function OfflineChatWidget() {
  const {
    statusData,
    modelActionBusy,
    reindexing,
    reindexMsg,
    sessions,
    sessionsLoading,
    activeSessionId,
    historyLoading,
    messages,
    inputText,
    isStreaming,
    phaseLabel,
    errorMsg,
    setInputText,
    setErrorMsg,
    refreshStatus,
    refreshSessions,
    handleStartModel,
    handleStopModel,
    handleReindex,
    handleSendMessage,
    handleStopStreaming,
    handleNewChat,
    handleSelectSession,
    handleRenameSession,
    handleDeleteSession,
  } = useOfflineChat();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showInspector, setShowInspector] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [openSourceIndices, setOpenSourceIndices] = useState({});

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const slots = statusData?.runtime?.slots || {};
  const memory = statusData?.runtime?.memory || null;
  const knowledge = statusData?.knowledge || null;
  const qwenSlot = slots.qwen_chat || {};
  const bgeSlot = slots.bge_m3_embedding || {};
  const effectiveQwenSlot = modelActionBusy === 'starting' ? { ...qwenSlot, status: 'loading' } : qwenSlot;
  const isKnowledgeEmpty = Boolean(knowledge && knowledge.doc_count === 0);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    setOpenSourceIndices({});
  }, [activeSessionId]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const toggleSourcesForMsg = (index) => {
    setOpenSourceIndices((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const fabDotClass =
    effectiveQwenSlot.status === 'ready'
      ? 'is-ready'
      : effectiveQwenSlot.status === 'loading'
        ? 'is-loading'
        : effectiveQwenSlot.status === 'error'
          ? 'is-error'
          : '';

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          className="atelier-offline-fab"
          onClick={() => setIsOpen(true)}
          title="Mở Trợ Lý AI (RAG Offline)"
        >
          <span className={`atelier-offline-fab-dot ${fabDotClass}`} />
          <Cpu size={18} />
          <span>Trợ Lý AI</span>
        </button>
      )}

      {/* Giữ cửa sổ gắn trong DOM bằng hidden để không mất hội thoại khi thu nhỏ rồi mở lại */}
      <div
        className={`atelier-offline-widget-window ${isExpanded ? 'expanded' : ''}`}
        hidden={!isOpen}
        aria-label="Trợ Lý AI RAG Offline"
      >
        {/* Thanh tiêu đề 1 hàng gọn nhẹ, giữ đủ nút bật/tắt model, chỉ mục và phóng to */}
        <header className="atelier-offline-widget-header">
          <div className="atelier-offline-widget-title">
            <div className="atelier-offline-chat-badge-icon is-compact">
              <Cpu size={16} />
            </div>
            <div className="atelier-offline-title-text">
              <h4>Trợ Lý AI</h4>
              <div className="atelier-offline-subtitle-row">
                <OfflineModelStatusPill slot={effectiveQwenSlot} />
                {knowledge && (
                  <span className="atelier-offline-mini-meta">
                    {knowledge.doc_count} tệp · {knowledge.chunk_count} đoạn
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="atelier-offline-widget-actions">
            {qwenSlot.running ? (
              <button
                type="button"
                className="atelier-offline-icon-btn is-danger"
                onClick={handleStopModel}
                disabled={Boolean(modelActionBusy) || isStreaming}
                title="Giải phóng RAM (Tắt Qwen3.5-4B & BGE-M3)"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="atelier-offline-icon-btn is-primary"
                onClick={handleStartModel}
                disabled={Boolean(modelActionBusy) || isStreaming}
                title="Khởi động Qwen3.5-4B"
              >
                <Play size={14} />
              </button>
            )}

            <button
              type="button"
              className={`atelier-offline-icon-btn ${reindexing ? 'is-spinning' : ''}`}
              onClick={() => handleReindex(false)}
              disabled={reindexing || isStreaming}
              title="Cập nhật chỉ mục kho tri thức docs/knowledge/"
            >
              <Database size={14} />
            </button>

            <button
              type="button"
              className={`atelier-offline-icon-btn ${showHistory ? 'is-active' : ''}`}
              onClick={() => {
                const nextOpen = !showHistory;
                setShowHistory(nextOpen);
                if (nextOpen) refreshSessions();
              }}
              title="Lịch sử cuộc trò chuyện"
            >
              <History size={14} />
            </button>

            <button
              type="button"
              className="atelier-offline-icon-btn"
              onClick={() => {
                handleNewChat();
                setShowHistory(false);
              }}
              title="Cuộc trò chuyện mới"
            >
              <Plus size={14} />
            </button>

            <button
              type="button"
              className={`atelier-offline-icon-btn ${showInspector ? 'is-active' : ''}`}
              onClick={() => setShowInspector((prev) => !prev)}
              title="Xem chi tiết model, RAM và điều khiển nâng cao"
            >
              <Sliders size={14} />
            </button>

            <button
              type="button"
              className="atelier-offline-icon-btn"
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? 'Thu nhỏ kích thước' : 'Mở rộng kích thước'}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            <button
              type="button"
              className="atelier-offline-icon-btn"
              onClick={() => setIsOpen(false)}
              title="Thu gọn thành bong bóng"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        {showHistory && (
          <OfflineHistoryDrawer
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            activeSessionId={activeSessionId}
            onSelectSession={(sid) => {
              handleSelectSession(sid);
              setShowHistory(false);
            }}
            onNewChat={() => {
              handleNewChat();
              setShowHistory(false);
            }}
            onRenameSession={handleRenameSession}
            onDeleteSession={handleDeleteSession}
            onClose={() => setShowHistory(false)}
          />
        )}

        {/* Ngăn kéo thông số model, RAM và thao tác đầy đủ (mặc định thu gọn) */}
        {showInspector && (
          <OfflineInspectorDrawer
            effectiveQwenSlot={effectiveQwenSlot}
            qwenSlot={qwenSlot}
            bgeSlot={bgeSlot}
            knowledge={knowledge}
            memory={memory}
            isKnowledgeEmpty={isKnowledgeEmpty}
            modelActionBusy={modelActionBusy}
            isStreaming={isStreaming}
            reindexing={reindexing}
            onRefreshStatus={() => refreshStatus()}
            onStartModel={handleStartModel}
            onStopModel={handleStopModel}
            onReindex={() => handleReindex(false)}
          />
        )}

        {isKnowledgeEmpty && (
          <div className="atelier-offline-banner is-warning" role="status">
            <span>
              Kho tri thức <code>docs/knowledge/</code> đang trống. Hãy thêm tệp <code>.md</code> và bấm Cập nhật chỉ mục.
            </span>
          </div>
        )}

        {reindexMsg && (
          <div className="atelier-offline-banner" role="status">
            <span>{reindexMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="atelier-offline-banner is-error" role="alert">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={15} />
              {errorMsg}
            </span>
            <button type="button" className="atelier-offline-btn" onClick={() => setErrorMsg('')}>
              Đóng
            </button>
          </div>
        )}

        {/* Vùng hội thoại */}
        <div className="atelier-offline-messages">
          {historyLoading ? (
            <div className="atelier-offline-empty">
              <p>Đang khôi phục nội dung hội thoại...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="atelier-offline-empty">
              <BookOpen size={26} />
              <h3>Trợ Lý AI (RAG Offline)</h3>
              <p>
                Tra cứu trực tiếp kho tri thức nội bộ <code>docs/knowledge/</code> bằng Qwen3.5-4B &amp; BGE-M3.
              </p>
              <div className="atelier-offline-suggestions">
                {OFFLINE_CHAT_SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="atelier-offline-suggestion-chip"
                    onClick={() => handleSendMessage(item)}
                    disabled={isStreaming}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const sources = Array.isArray(msg.sources) ? msg.sources : [];
              const sourcesOpen = Boolean(openSourceIndices[idx]);
              return (
                <div
                  key={`${msg.role}-${idx}`}
                  className={`atelier-offline-msg-row ${msg.role === 'user' ? 'is-user' : 'is-assistant'}`}
                >
                  <div className="atelier-offline-msg-bubble">
                    {msg.content || (msg.role === 'assistant' && isStreaming ? 'Đang xử lý...' : '')}
                  </div>
                  {msg.role === 'assistant' && (msg.status === 'cancelled' || msg.status === 'failed') && (
                    <span className={`atelier-offline-msg-status is-${msg.status}`}>
                      {msg.status === 'cancelled' ? 'Đã dừng giữa chừng' : 'Phản hồi bị gián đoạn'}
                    </span>
                  )}
                  {msg.role === 'assistant' && sources.length > 0 && (
                    <div className="atelier-offline-sources-wrap">
                      <button
                        type="button"
                        className="atelier-offline-sources-toggle"
                        onClick={() => toggleSourcesForMsg(idx)}
                      >
                        <FileText size={12} />
                        <span>{sources.length} nguồn tham khảo</span>
                        <ChevronDown size={12} className={sourcesOpen ? 'is-rotated' : ''} />
                      </button>
                      {sourcesOpen && (
                        <div className="atelier-offline-sources" aria-label="Nguồn tài liệu tham khảo">
                          {sources.map((src) => (
                            <span
                              key={src.chunk_id}
                              className="atelier-offline-source-tag"
                              title={`${src.doc_path} · ${src.title}`}
                            >
                              <FileText size={11} />
                              {src.doc_path} ({src.title}) · {(src.score * 100).toFixed(0)}%
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {phaseLabel && <div className="atelier-offline-phase">{phaseLabel}</div>}

        <div className="atelier-offline-composer">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập câu hỏi cho Trợ Lý AI Offline..."
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              type="button"
              className="atelier-offline-btn is-danger"
              onClick={handleStopStreaming}
              title="Dừng sinh câu trả lời"
            >
              <Square size={15} /> Dừng
            </button>
          ) : (
            <button
              type="button"
              className="atelier-offline-btn is-primary"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim()}
            >
              <Send size={15} /> Gửi
            </button>
          )}
        </div>
      </div>
    </>
  );
}
