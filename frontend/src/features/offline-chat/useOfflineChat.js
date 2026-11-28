// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý state & vòng đời luồng SSE)
// ========================================================
import { useEffect, useRef, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// (Không phụ thuộc thư viện bên ngoài)

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (API Chatbot RAG Offline & Lịch sử)
// ========================================================
import {
  deleteOfflineSession,
  fetchOfflineChatStatus,
  fetchOfflineSessionDetail,
  fetchOfflineSessions,
  reindexOfflineKnowledge,
  renameOfflineSession,
  startOfflineChatModel,
  stopOfflineChatModel,
  streamOfflineChatApi,
} from './offlineChatApi';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH
// ========================================================
const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'failed']);

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Custom Hook điều khiển trạng thái model, lịch sử hội thoại MySQL và luồng hỏi đáp RAG Offline.
 *
 * @returns {Object} Trạng thái model, kho tri thức, danh sách phiên và các hàm tương tác.
 */
export function useOfflineChat() {
  const [statusData, setStatusData] = useState(null);
  const [modelActionBusy, setModelActionBusy] = useState('');
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState('');

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const streamAbortRef = useRef(null);
  const loadAbortRef = useRef(null);
  const activeSessionIdRef = useRef(null);

  /** Tải mới trạng thái model, RAM khả dụng và thống kê kho tri thức. */
  const refreshStatus = async (signal) => {
    try {
      const data = await fetchOfflineChatStatus({ signal });
      if (!signal?.aborted) setStatusData(data);
    } catch (err) {
      if (!signal?.aborted) {
        setErrorMsg(err.message || 'Không thể đọc trạng thái Chatbot RAG Offline.');
      }
    }
  };

  /** Tải danh sách lịch sử hội thoại của tài khoản đang đăng nhập. */
  const refreshSessions = async (signal) => {
    setSessionsLoading(true);
    try {
      const data = await fetchOfflineSessions({ signal });
      if (!signal?.aborted) {
        setSessions(Array.isArray(data?.items) ? data.items : []);
      }
    } catch (err) {
      if (!signal?.aborted && !String(err.message || '').includes('401')) {
        setErrorMsg(err.message || 'Không thể tải danh sách lịch sử hội thoại.');
      }
    } finally {
      if (!signal?.aborted) setSessionsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    refreshStatus(controller.signal);
    refreshSessions(controller.signal);
    return () => {
      controller.abort();
      loadAbortRef.current?.abort();
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
    };
  }, []);

  /** Dừng luồng sinh câu trả lời SSE ngay lập tức. */
  const handleStopStreaming = () => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
    setIsStreaming(false);
    setPhaseLabel('');
  };

  /** Bật trước mô hình Qwen3.5-4B vào RAM. */
  const handleStartModel = async () => {
    if (modelActionBusy || isStreaming) return;
    setModelActionBusy('starting');
    setErrorMsg('');
    try {
      await startOfflineChatModel();
      await refreshStatus();
    } catch (err) {
      setErrorMsg(err.message || 'Không thể khởi động mô hình Qwen3.5-4B.');
    } finally {
      setModelActionBusy('');
    }
  };

  /** Giải phóng các mô hình RAG Offline khỏi RAM. */
  const handleStopModel = async () => {
    if (modelActionBusy || isStreaming) return;
    setModelActionBusy('stopping');
    setErrorMsg('');
    try {
      await stopOfflineChatModel();
      await refreshStatus();
    } catch (err) {
      setErrorMsg(err.message || 'Không thể giải phóng mô hình khỏi RAM.');
    } finally {
      setModelActionBusy('');
    }
  };

  /** Đồng bộ tăng dần hoặc xây dựng lại toàn bộ chỉ mục vector từ docs/knowledge/. */
  const handleReindex = async (forceRebuild = false) => {
    if (reindexing || isStreaming) return;
    setReindexing(true);
    setErrorMsg('');
    setReindexMsg('');
    try {
      const res = await reindexOfflineKnowledge(forceRebuild);
      const sync = res?.sync || {};
      if (sync.status === 'empty') {
        setReindexMsg('Kho tri thức hiện đang trống (0 tài liệu Markdown).');
      } else if (sync.status === 'up_to_date') {
        setReindexMsg(`Chỉ mục đã đồng bộ sẵn (${sync.chunk_count} đoạn, không cần nhúng lại).`);
      } else {
        setReindexMsg(
          `Đã cập nhật ${sync.chunk_count} đoạn (+${sync.added || 0} mới, ~${sync.updated || 0} sửa, -${sync.removed || 0} xóa, tái sử dụng ${sync.reused || 0} tài liệu).`
        );
      }
      await refreshStatus();
    } catch (err) {
      setErrorMsg(err.message || 'Không thể cập nhật chỉ mục tài liệu RAG.');
    } finally {
      setReindexing(false);
    }
  };

  /** Khởi tạo cuộc trò chuyện mới (ngắt stream cũ nếu đang chạy). */
  const handleNewChat = () => {
    loadAbortRef.current?.abort();
    if (isStreaming) handleStopStreaming();
    activeSessionIdRef.current = null;
    setActiveSessionId(null);
    setMessages([]);
    setHistoryLoading(false);
    setErrorMsg('');
  };

  /** Chọn một hội thoại cũ để khôi phục tin nhắn + nguồn RAG từ DB (không gọi model AI). */
  const handleSelectSession = async (sessionId) => {
    if (!sessionId) return;
    if (isStreaming) handleStopStreaming();
    loadAbortRef.current?.abort();

    const controller = new AbortController();
    loadAbortRef.current = controller;
    activeSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
    setHistoryLoading(true);
    setErrorMsg('');

    try {
      const detail = await fetchOfflineSessionDetail(sessionId, { signal: controller.signal });
      if (controller.signal.aborted || activeSessionIdRef.current !== sessionId) return;
      setMessages(Array.isArray(detail?.messages) ? detail.messages : []);
    } catch (err) {
      if (!controller.signal.aborted && activeSessionIdRef.current === sessionId) {
        setErrorMsg(err.message || 'Không thể tải lại nội dung cuộc trò chuyện.');
      }
    } finally {
      if (!controller.signal.aborted && activeSessionIdRef.current === sessionId) {
        setHistoryLoading(false);
      }
    }
  };

  /** Đổi tên cuộc trò chuyện và cập nhật ngay danh sách hiển thị. */
  const handleRenameSession = async (sessionId, newTitle) => {
    const cleanTitle = (newTitle || '').trim();
    if (!cleanTitle) return false;
    try {
      const res = await renameOfflineSession(sessionId, cleanTitle);
      const updated = res?.session;
      if (updated) {
        setSessions((prev) => [updated, ...prev.filter((item) => item.id !== updated.id)]);
      } else {
        await refreshSessions();
      }
      return true;
    } catch (err) {
      setErrorMsg(err.message || 'Không thể đổi tên cuộc trò chuyện.');
      return false;
    }
  };

  /** Xóa cuộc trò chuyện khỏi MySQL; nếu đang xem đúng phiên đó thì chuyển về hội thoại mới. */
  const handleDeleteSession = async (sessionId) => {
    if (activeSessionIdRef.current === sessionId && isStreaming) {
      handleStopStreaming();
    }
    try {
      await deleteOfflineSession(sessionId);
      setSessions((prev) => prev.filter((item) => item.id !== sessionId));
      if (activeSessionIdRef.current === sessionId) {
        activeSessionIdRef.current = null;
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Không thể xóa cuộc trò chuyện.');
    }
  };

  /** Cập nhật an toàn tin nhắn assistant cuối cùng của lượt hiện tại. */
  const updateLastAssistantMessage = (updater) => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const last = next[next.length - 1];
      if (last.role === 'assistant') {
        next[next.length - 1] = updater(last);
      }
      return next;
    });
  };

  /** Gửi câu hỏi hiện tại với `{ session_id, message, request_id }` và đọc luồng SSE. */
  const handleSendMessage = async (customQuery) => {
    const cleanMessage = (typeof customQuery === 'string' ? customQuery : inputText).trim();
    if (!cleanMessage || isStreaming) return;

    const targetSessionId = activeSessionIdRef.current;
    const requestId = createRequestId();

    setInputText('');
    setErrorMsg('');
    setPhaseLabel('Đang truy xuất tài liệu...');
    setIsStreaming(true);

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: cleanMessage, status: 'completed', request_id: requestId },
      { role: 'assistant', content: '', sources: [], status: 'generating', request_id: requestId },
    ]);

    const controller = new AbortController();
    streamAbortRef.current = controller;

    await streamOfflineChatApi({
      sessionId: targetSessionId,
      message: cleanMessage,
      requestId,
      signal: controller.signal,
      onSession: (sessionObj) => {
        if (!sessionObj?.id) return;
        activeSessionIdRef.current = sessionObj.id;
        setActiveSessionId(sessionObj.id);
        setSessions((prev) => [sessionObj, ...prev.filter((item) => item.id !== sessionObj.id)]);
      },
      onStatus: (status, message) => {
        if (TERMINAL_STATUSES.has(status)) {
          updateLastAssistantMessage((last) => ({ ...last, status }));
          setPhaseLabel('');
          return;
        }
        setPhaseLabel(message || status);
      },
      onSources: (sources) => {
        updateLastAssistantMessage((last) => ({ ...last, sources }));
      },
      onChunk: (chunkText) => {
        updateLastAssistantMessage((last) => ({ ...last, content: last.content + chunkText }));
      },
      onError: (err) => {
        updateLastAssistantMessage((last) => ({ ...last, status: 'failed' }));
        setErrorMsg(err);
        setIsStreaming(false);
        setPhaseLabel('');
        streamAbortRef.current = null;
        refreshStatus();
        refreshSessions();
      },
      onDone: ({ aborted } = {}) => {
        if (aborted) {
          updateLastAssistantMessage((last) => ({
            ...last,
            status: last.status === 'generating' ? 'cancelled' : last.status,
          }));
        }
        setIsStreaming(false);
        setPhaseLabel('');
        streamAbortRef.current = null;
        refreshStatus();
        refreshSessions();
      },
    });
  };

  return {
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
  };
}
