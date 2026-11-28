// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý đóng/mở cửa sổ, phóng to & cuộn)
// ========================================================
import React, { lazy, Suspense, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng FAB Trợ Lý AI, điều khiển model, chỉ mục và nguồn tham chiếu
import {
  AlertCircle, ArrowDown, Cpu, History, Maximize2,
  MessageSquarePlus, Minimize2, Sliders, Sparkles, X,
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Hook RAG Offline, Ngăn kéo Lịch sử/Thông số & Câu hỏi mẫu)
// ========================================================
import { OFFLINE_CHAT_SUGGESTIONS } from '../../constants/offlineChatSamples';
import OfflineHistoryDrawer from './OfflineHistoryDrawer';
import OfflineInspectorDrawer, { OfflineModelStatusPill } from './OfflineInspectorDrawer';
import { useOfflineChat } from './useOfflineChat';
import { useChatViewport } from './useChatViewport';

import OfflineChatComposer from './OfflineChatComposer';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
import './offline-chat.css';

// Chỉ tải trình Markdown khi có hội thoại, giữ nút chat ban đầu nhẹ.
const OfflineChatMessages = lazy(() => import('./OfflineChatMessages'));

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { messagesRef, showScrollButton, handleScroll, scrollToBottom } = useChatViewport({
    messages, activeSessionId, isOpen, historyLoading,
  });
  const sendMessage = (query) => {
    scrollToBottom();
    handleSendMessage(query);
  };

  const slots = statusData?.runtime?.slots || {};
  const memory = statusData?.runtime?.memory || null;
  const knowledge = statusData?.knowledge || null;
  const qwenSlot = slots.qwen_chat || {};
  const bgeSlot = slots.bge_m3_embedding || {};
  const effectiveQwenSlot = modelActionBusy === 'starting' ? { ...qwenSlot, status: 'loading' } : qwenSlot;
  const isKnowledgeEmpty = Boolean(knowledge && knowledge.doc_count === 0);

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
        role="region"
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
            <button
              type="button"
              className={`atelier-offline-icon-btn ${showHistory ? 'is-active' : ''}`}
              onClick={() => {
                const nextOpen = !showHistory;
                setShowHistory(nextOpen);
                if (nextOpen) refreshSessions();
              }}
              aria-label="Lịch sử cuộc trò chuyện"
              aria-expanded={showHistory}
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
              aria-label="Cuộc trò chuyện mới"
              title="Cuộc trò chuyện mới"
            >
              <MessageSquarePlus size={17} />
            </button>

            <button
              type="button"
              className={`atelier-offline-icon-btn ${showInspector ? 'is-active' : ''}`}
              onClick={() => setShowInspector((prev) => !prev)}
              aria-label="Thông tin và điều khiển model"
              aria-expanded={showInspector}
              title="Xem chi tiết model, RAM và điều khiển nâng cao"
            >
              <Sliders size={14} />
            </button>

            <button
              type="button"
              className="atelier-offline-icon-btn"
              onClick={() => {
                setIsExpanded((prev) => !prev);
                if (!isExpanded) { setShowHistory(true); refreshSessions(); }
              }}
              aria-label={isExpanded ? 'Thu nhỏ kích thước' : 'Mở rộng kích thước'}
              title={isExpanded ? 'Thu nhỏ kích thước' : 'Mở rộng kích thước'}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            <button
              type="button"
              className="atelier-offline-icon-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Thu gọn thành bong bóng"
              title="Thu gọn thành bong bóng"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        <div className="atelier-offline-workspace">
        {showHistory && (
          <OfflineHistoryDrawer
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            activeSessionId={activeSessionId}
            onSelectSession={(sid) => {
              handleSelectSession(sid);
              if (!isExpanded || window.innerWidth < 700) setShowHistory(false);
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

        <div className="atelier-offline-main">
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
        <div className="atelier-offline-conversation">
        <div className="atelier-offline-messages" ref={messagesRef} onScroll={handleScroll} aria-label="Nội dung hội thoại" aria-busy={historyLoading}>
          <div className="atelier-offline-message-column">
          {historyLoading ? (
            <div className="atelier-offline-empty">
              <p>Đang khôi phục nội dung hội thoại...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="atelier-offline-empty">
              <div className="atelier-offline-welcome-mark"><Sparkles size={27} /></div>
              <span className="atelier-offline-eyebrow">TRỢ LÝ TRONG XƯỞNG CỦA BẠN</span>
              <h3>Bạn đang sáng tạo điều gì?</h3>
              <p>
                Từ một khung hình đến chuyển động hoàn chỉnh. Cùng tìm câu trả lời trong tài liệu của bạn.
              </p>
              <div className="atelier-offline-suggestions">
                {OFFLINE_CHAT_SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="atelier-offline-suggestion-chip"
                    onClick={() => sendMessage(item)}
                    disabled={isStreaming}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Suspense fallback={<p className="atelier-offline-thinking">Đang hiển thị hội thoại…</p>}>
              <OfflineChatMessages key={activeSessionId || 'new'} messages={messages} isStreaming={isStreaming} />
            </Suspense>
          )}
          </div>
        </div>
        {showScrollButton && <button type="button" className="atelier-offline-scroll-bottom" onClick={scrollToBottom} aria-label="Xuống cuối hội thoại" title="Xuống cuối hội thoại"><ArrowDown size={17} /></button>}
        </div>

        {phaseLabel && <div className="atelier-offline-phase">{phaseLabel}</div>}

        <OfflineChatComposer value={inputText} onChange={setInputText} onSend={() => sendMessage()} onStop={handleStopStreaming} isStreaming={isStreaming} isOpen={isOpen} isExpanded={isExpanded} />
        </div>
        </div>
      </div>
    </>
  );
}
