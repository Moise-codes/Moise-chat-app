import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X, Video, Paperclip, Mic, MicOff, Bold, Italic, Smile, StrikethroughIcon } from "lucide-react";
import toast from "react-hot-toast";
import EmojiPicker from "emoji-picker-react";
import { useAuthStore } from "../store/useAuthStore";

const MessageInput = ({ replyTo, onCancelReply }) => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isStrike, setIsStrike] = useState(false);

  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const docInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiPickerRef = useRef(null);

  const { sendMessage, setTyping } = useChatStore();
  const { authUser } = useAuthStore();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (text.trim()) {
      setTyping(true);
    } else {
      setTyping(false);
    }
  }, [text]);

  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } else {
      clearInterval(recordingTimerRef.current);
      setRecordingTime(0);
    }
    return () => clearInterval(recordingTimerRef.current);
  }, [isRecording]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file?.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    setVideoPreview(null); setFilePreview(null);
  };

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (!file?.type.startsWith("video/")) { toast.error("Please select a video file"); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error("Video must be under 50MB"); return; }
    const reader = new FileReader();
    reader.onloadend = () => setVideoPreview(reader.result);
    reader.readAsDataURL(file);
    setImagePreview(null); setFilePreview(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("File must be under 20MB"); return; }
    const reader = new FileReader();
    reader.onloadend = () => setFilePreview({ name: file.name, type: file.type, data: reader.result });
    reader.readAsDataURL(file);
    setImagePreview(null); setVideoPreview(null);
  };

  const removeImage = () => { setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; };
  const removeVideo = () => { setVideoPreview(null); if (videoInputRef.current) videoInputRef.current.value = ""; };
  const removeFile = () => { setFilePreview(null); if (docInputRef.current) docInputRef.current.value = ""; };
  const removeAudio = () => { setAudioBlob(null); };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
    textareaRef.current?.focus();
  };

  const applyFormat = (format) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.slice(start, end);
    const markers = { bold: "**", italic: "_", strike: "~~" };
    const marker = markers[format];
    if (!marker) return;
    const newText = text.slice(0, start) + marker + selected + marker + text.slice(end);
    setText(newText);
    if (format === "bold") setIsBold(!isBold);
    if (format === "italic") setIsItalic(!isItalic);
    if (format === "strike") setIsStrike(!isStrike);
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const toBase64 = (blob) => new Promise((res) => {
    const reader = new FileReader();
    reader.onloadend = () => res(reader.result);
    reader.readAsDataURL(blob);
  });

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview && !videoPreview && !filePreview && !audioBlob) return;

    try {
      let audioData = null;
      if (audioBlob) audioData = await toBase64(audioBlob);

      await sendMessage({
        text: text.trim(),
        image: imagePreview,
        video: videoPreview,
        file: filePreview?.data,
        fileName: filePreview?.name,
        fileType: filePreview?.type,
        audio: audioData,
        replyTo: replyTo?._id || null,
      });

      setText("");
      setImagePreview(null);
      setVideoPreview(null);
      setFilePreview(null);
      setAudioBlob(null);
      setTyping(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
      if (docInputRef.current) docInputRef.current.value = "";
      if (onCancelReply) onCancelReply();
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="p-2 sm:p-4 w-full">
      {/* Reply preview */}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 bg-base-200 rounded-lg px-3 py-2 text-sm">
          <div className="flex-1 border-l-2 border-primary pl-2 opacity-70 truncate">
            <span className="font-semibold">{replyTo.senderId === authUser._id ? "You" : "Them"}: </span>
            {replyTo.text || (replyTo.image ? "📷 Image" : replyTo.video ? "🎥 Video" : "📎 File")}
          </div>
          <button onClick={onCancelReply} className="text-error"><X size={14} /></button>
        </div>
      )}

      {/* Previews */}
      {(imagePreview || videoPreview || filePreview || audioBlob) && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          {imagePreview && (
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-zinc-700" />
              <button onClick={removeImage} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center" type="button"><X className="size-3" /></button>
            </div>
          )}
          {videoPreview && (
            <div className="relative">
              <video src={videoPreview} className="w-32 h-20 object-cover rounded-lg border border-zinc-700" />
              <button onClick={removeVideo} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center" type="button"><X className="size-3" /></button>
            </div>
          )}
          {filePreview && (
            <div className="relative flex items-center gap-2 bg-base-200 rounded-lg px-3 py-2">
              <Paperclip size={16} />
              <span className="text-xs max-w-[120px] truncate">{filePreview.name}</span>
              <button onClick={removeFile} className="ml-1" type="button"><X className="size-3" /></button>
            </div>
          )}
          {audioBlob && (
            <div className="relative flex items-center gap-2 bg-base-200 rounded-lg px-3 py-2">
              <Mic size={16} className="text-primary" />
              <audio controls src={URL.createObjectURL(audioBlob)} className="h-8 max-w-[160px]" />
              <button onClick={removeAudio} className="ml-1" type="button"><X className="size-3" /></button>
            </div>
          )}
        </div>
      )}

      {/* Rich text toolbar */}
      <div className="flex items-center gap-1 mb-2">
        <button type="button" onClick={() => applyFormat("bold")} className={`btn btn-xs btn-ghost font-bold ${isBold ? "btn-active" : ""}`} title="Bold"><Bold size={13} /></button>
        <button type="button" onClick={() => applyFormat("italic")} className={`btn btn-xs btn-ghost italic ${isItalic ? "btn-active" : ""}`} title="Italic"><Italic size={13} /></button>
        <button type="button" onClick={() => applyFormat("strike")} className={`btn btn-xs btn-ghost ${isStrike ? "btn-active" : ""}`} title="Strikethrough"><StrikethroughIcon size={13} /></button>
      </div>

      {/* Input row */}
      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-1 sm:gap-2 items-center relative">
          {/* Emoji picker */}
          <div className="relative" ref={emojiPickerRef}>
            <button type="button" className="btn btn-circle btn-sm btn-ghost text-zinc-400" onClick={() => setShowEmojiPicker((v) => !v)} title="Emoji">
              <Smile size={18} />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-12 left-0 z-50">
                <EmojiPicker onEmojiClick={handleEmojiClick} height={350} width={300} theme="auto" />
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            className="flex-1 textarea textarea-bordered rounded-lg textarea-sm sm:textarea-md resize-none min-h-[40px] max-h-[120px]"
            placeholder="Type a message..."
            value={text}
            rows={1}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
          />

          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
          <input type="file" accept="video/*" className="hidden" ref={videoInputRef} onChange={handleVideoChange} />
          <input type="file" accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx" className="hidden" ref={docInputRef} onChange={handleFileChange} />

          <button type="button" className={`btn btn-circle btn-sm ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`} onClick={() => fileInputRef.current?.click()} title="Image">
            <Image size={18} />
          </button>
          <button type="button" className={`hidden sm:flex btn btn-circle btn-sm ${videoPreview ? "text-emerald-500" : "text-zinc-400"}`} onClick={() => videoInputRef.current?.click()} title="Video">
            <Video size={18} />
          </button>
          <button type="button" className={`hidden sm:flex btn btn-circle btn-sm ${filePreview ? "text-emerald-500" : "text-zinc-400"}`} onClick={() => docInputRef.current?.click()} title="Attach file">
            <Paperclip size={18} />
          </button>
          <button
            type="button"
            className={`hidden sm:flex btn btn-circle btn-sm ${isRecording ? "text-error animate-pulse" : "text-zinc-400"}`}
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? `Stop recording (${formatTime(recordingTime)})` : "Voice message"}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          {isRecording && <span className="text-xs text-error font-mono">{formatTime(recordingTime)}</span>}
        </div>

        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={!text.trim() && !imagePreview && !videoPreview && !filePreview && !audioBlob}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;