import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { Trash2, X, ZoomIn, Download, Share2, SmilePlus, Reply, FileText } from "lucide-react";
import Linkify from "react-linkify";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const LinkPreview = ({ text }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text?.match(urlRegex);
  if (!urls) return null;
  const url = urls[0];
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
  if (isYoutube) {
    const videoId = url.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1];
    if (videoId) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden border border-base-300 max-w-[260px]">
          <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="YouTube preview" className="w-full object-cover" />
          <div className="p-2 bg-base-200 flex items-center gap-2">
            <span className="text-xs font-semibold text-error">▶ YouTube</span>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline truncate opacity-70">{url}</a>
          </div>
        </div>
      );
    }
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs underline opacity-70 truncate max-w-[220px]">{url}</a>
  );
};

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    deleteMessage,
    addReaction,
    typingUsers,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  const [zoomedImage, setZoomedImage] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);

  useEffect(() => {
    if (selectedUser?._id) {
      getMessages(selectedUser._id);
      subscribeToMessages();
    }
    return () => unsubscribeFromMessages();
  }, [selectedUser?._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleDeleteMessage = async (messageId) => {
    await deleteMessage(messageId);
    setConfirmDeleteId(null);
  };

  const handleDownloadImage = async (imageUrl) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "image_" + Date.now() + ".jpg";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, "_blank");
    }
  };

  const handleShareImage = async (imageUrl) => {
    if (navigator.share) {
      try { await navigator.share({ url: imageUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(imageUrl);
      alert("Image URL copied to clipboard!");
    }
  };

  const handleReaction = (messageId, emoji) => {
    addReaction(messageId, emoji);
    setReactionPickerMsgId(null);
  };

  const isTyping = typingUsers?.includes(selectedUser?._id);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={message._id}
            className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"} group`}
            ref={index === messages.length - 1 ? messageEndRef : null}
          >
            <div className="chat-image avatar">
              <div className="size-8 sm:size-10 rounded-full border">
                <img
                  src={
                    message.senderId === authUser._id
                      ? authUser.profilePic || "/avatar.png"
                      : selectedUser.profilePic || "/avatar.png"
                  }
                  alt="profile pic"
                />
              </div>
            </div>

            <div className="chat-header mb-1">
              <span className="font-semibold text-xs mr-1">
                {message.senderId === authUser._id ? authUser.fullName : selectedUser.fullName}
              </span>
              <time className="text-xs opacity-50">{formatMessageTime(message.createdAt)}</time>
            </div>

            {/* Reply reference */}
            {message.replyTo && (
              <div className="opacity-60 text-xs mb-1 border-l-2 border-primary pl-2 max-w-[200px] truncate">
                ↩ {message.replyTo.text || (message.replyTo.image ? "📷 Image" : message.replyTo.video ? "🎥 Video" : "📎 File")}
              </div>
            )}

            <div className={`chat-bubble flex flex-col max-w-[80vw] sm:max-w-none ${
              message.senderId === authUser._id
                ? "bg-primary text-primary-content"
                : "bg-base-200 text-base-content"
            }`}>
              {/* Image */}
              {message.image && (
                <div className="relative group/img mb-2">
                  <img
                    src={message.image}
                    alt="Attachment"
                    className="max-w-[160px] sm:max-w-[200px] rounded-md cursor-zoom-in"
                    onClick={() => setZoomedImage(message.image)}
                  />
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                    <button onClick={() => setZoomedImage(message.image)} className="btn btn-xs btn-circle bg-black/50 border-none text-white hover:bg-black/70" title="Zoom"><ZoomIn size={12} /></button>
                    <button onClick={() => handleDownloadImage(message.image)} className="btn btn-xs btn-circle bg-black/50 border-none text-white hover:bg-black/70" title="Download"><Download size={12} /></button>
                    <button onClick={() => handleShareImage(message.image)} className="btn btn-xs btn-circle bg-black/50 border-none text-white hover:bg-black/70" title="Share"><Share2 size={12} /></button>
                  </div>
                </div>
              )}

              {/* Video */}
              {message.video && (
                <video src={message.video} controls className="max-w-[220px] sm:max-w-[280px] rounded-md mb-2" />
              )}

              {/* File attachment */}
              {message.fileUrl && (
                
                  href={message.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-black/10 rounded-lg px-3 py-2 mb-2 hover:bg-black/20 transition-colors"
                >
                  <FileText size={18} />
                  <span className="text-xs underline truncate max-w-[160px]">{message.fileName || "Download file"}</span>
                  <Download size={14} />
                </a>
              )}

              {/* Audio */}
              {message.audio && (
                <audio controls src={message.audio} className="max-w-[220px] mb-2" />
              )}

              {/* Text with linkify */}
              {message.text && (
                <Linkify componentDecorator={(href, text, key) => (
                  <a href={href} key={key} target="_blank" rel="noopener noreferrer" className="underline opacity-80">{text}</a>
                )}>
                  <p>{message.text}</p>
                </Linkify>
              )}

              {/* Link / YouTube preview */}
              {message.text && <LinkPreview text={message.text} />}
            </div>

            {/* Hover action buttons */}
            <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${message.senderId === authUser._id ? "flex-row-reverse" : "flex-row"}`}>
              <div className="relative">
                <button onClick={() => setReactionPickerMsgId(reactionPickerMsgId === message._id ? null : message._id)} className="btn btn-xs btn-ghost text-zinc-400" title="React">
                  <SmilePlus size={13} />
                </button>
                {reactionPickerMsgId === message._id && (
                  <div className={`absolute bottom-8 z-50 bg-base-100 border border-base-300 rounded-xl shadow-lg p-2 flex gap-1 ${message.senderId === authUser._id ? "right-0" : "left-0"}`}>
                    {REACTIONS.map((emoji) => (
                      <button key={emoji} onClick={() => handleReaction(message._id, emoji)} className="text-lg hover:scale-125 transition-transform">{emoji}</button>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => setReplyTo(message)} className="btn btn-xs btn-ghost text-zinc-400" title="Reply">
                <Reply size={13} />
              </button>

              {message.senderId === authUser._id && !message.isTemp && (
                confirmDeleteId === message._id ? (
                  <div className="flex items-center gap-1 text-xs">
                    <span className="opacity-70">Delete?</span>
                    <button onClick={() => handleDeleteMessage(message._id)} className="text-error font-semibold hover:underline">Yes</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="opacity-60 hover:underline">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(message._id)} className="btn btn-xs btn-ghost text-error/70 hover:text-error" title="Delete">
                    <Trash2 size={13} />
                  </button>
                )
              )}
            </div>

            {/* Reactions display */}
            {message.reactions && message.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(
                  message.reactions.reduce((acc, r) => {
                    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([emoji, count]) => (
                  <button key={emoji} onClick={() => handleReaction(message._id, emoji)} className="flex items-center gap-0.5 bg-base-200 hover:bg-base-300 rounded-full px-2 py-0.5 text-xs transition-colors">
                    {emoji} {count > 1 && <span className="opacity-70">{count}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="chat chat-start">
            <div className="chat-image avatar">
              <div className="size-8 sm:size-10 rounded-full border">
                <img src={selectedUser.profilePic || "/avatar.png"} alt="typing" />
              </div>
            </div>
            <div className="chat-bubble bg-base-200 text-base-content flex items-center gap-1 py-3 px-4">
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      <MessageInput replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />

      {/* Image lightbox */}
      {zoomedImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setZoomedImage(null)} className="absolute -top-4 -right-4 btn btn-circle btn-sm bg-black/60 border-none text-white hover:bg-black/80 z-10"><X size={16} /></button>
            <img src={zoomedImage} alt="Zoomed" className="max-w-[85vw] max-h-[80vh] object-contain rounded-lg shadow-2xl" />
            <div className="flex justify-center gap-3 mt-3">
              <button onClick={() => handleDownloadImage(zoomedImage)} className="btn btn-sm gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"><Download size={14} /> Download</button>
              <button onClick={() => handleShareImage(zoomedImage)} className="btn btn-sm gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"><Share2 size={14} /> Share</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatContainer;