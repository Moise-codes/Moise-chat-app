import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { Trash2, X, ZoomIn, Download, Share2 } from "lucide-react";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    deleteMessage,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  const [zoomedImage, setZoomedImage] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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
      try {
        await navigator.share({ url: imageUrl });
      } catch {}
    } else {
      await navigator.clipboard.writeText(imageUrl);
      alert("Image URL copied to clipboard!");
    }
  };

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
            className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}
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
              <time className="text-xs opacity-50">
                {formatMessageTime(message.createdAt)}
              </time>
            </div>
            <div className={`chat-bubble flex flex-col max-w-[80vw] sm:max-w-none ${
              message.senderId === authUser._id
                ? "bg-primary text-primary-content"
                : "bg-base-200 text-base-content"
            }`}>
              {message.image && (
                <div className="relative group/img mb-2">
                  <img
                    src={message.image}
                    alt="Attachment"
                    className="max-w-[160px] sm:max-w-[200px] rounded-md cursor-zoom-in"
                    onClick={() => setZoomedImage(message.image)}
                  />
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                    <button
                      onClick={() => setZoomedImage(message.image)}
                      className="btn btn-xs btn-circle bg-black/50 border-none text-white hover:bg-black/70"
                      title="Zoom"
                    >
                      <ZoomIn size={12} />
                    </button>
                    <button
                      onClick={() => handleDownloadImage(message.image)}
                      className="btn btn-xs btn-circle bg-black/50 border-none text-white hover:bg-black/70"
                      title="Download"
                    >
                      <Download size={12} />
                    </button>
                    <button
                      onClick={() => handleShareImage(message.image)}
                      className="btn btn-xs btn-circle bg-black/50 border-none text-white hover:bg-black/70"
                      title="Share"
                    >
                      <Share2 size={12} />
                    </button>
                  </div>
                </div>
              )}
              {message.text && <p>{message.text}</p>}
            </div>

            {message.senderId === authUser._id && !message.isTemp && (
              <div className="chat-footer mt-1">
                {confirmDeleteId === message._id ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="opacity-70">Delete?</span>
                    <button
                      onClick={() => handleDeleteMessage(message._id)}
                      className="text-error font-semibold hover:underline"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="opacity-60 hover:underline"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(message._id)}
                    className="opacity-0 hover:opacity-100 transition-opacity text-error/70 hover:text-error"
                    title="Delete message"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <MessageInput />

      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute -top-4 -right-4 btn btn-circle btn-sm bg-black/60 border-none text-white hover:bg-black/80 z-10"
            >
              <X size={16} />
            </button>
            <img
              src={zoomedImage}
              alt="Zoomed"
              className="max-w-[85vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="flex justify-center gap-3 mt-3">
              <button
                onClick={() => handleDownloadImage(zoomedImage)}
                className="btn btn-sm gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Download size={14} /> Download
              </button>
              <button
                onClick={() => handleShareImage(zoomedImage)}
                className="btn btn-sm gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Share2 size={14} /> Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatContainer;