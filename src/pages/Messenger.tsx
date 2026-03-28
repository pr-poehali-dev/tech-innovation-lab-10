import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost, getUser, logout } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";

interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface Chat {
  id: number;
  other_user: User;
  last_message: string;
  last_message_at: string | null;
  updated_at: string;
}

interface Message {
  id: number;
  sender_id: number;
  content: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
  sender_display_name: string;
  sender_avatar: string | null;
}

const Messenger = () => {
  const navigate = useNavigate();
  const currentUser = getUser();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
    }
  }, []);

  const loadChats = useCallback(async () => {
    if (!currentUser) return;
    const data = await apiGet("chats", "list", { user_id: currentUser.user_id });
    if (data.chats) setChats(data.chats);
  }, []);

  const loadMessages = useCallback(async (chatId: number) => {
    if (!currentUser) return;
    const data = await apiGet("chats", "messages", { chat_id: chatId, user_id: currentUser.user_id });
    if (data.messages) setMessages(data.messages);
  }, []);

  useEffect(() => {
    loadChats();
    const interval = setInterval(loadChats, 5000);
    return () => clearInterval(interval);
  }, [loadChats]);

  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat.id);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => loadMessages(activeChat.id), 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeChat, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentUser) return;
    const data = await apiPost("auth", "users", { search: searchQuery, user_id: currentUser.user_id });
    if (data.users) setSearchResults(data.users);
  };

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const t = setTimeout(handleSearch, 300);
      return () => clearTimeout(t);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const startChat = async (otherUser: User) => {
    if (!currentUser) return;
    const data = await apiPost("chats", "create", {
      user_id: currentUser.user_id,
      other_user_id: otherUser.id,
    });
    if (data.chat_id) {
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      await loadChats();
      setActiveChat({
        id: data.chat_id,
        other_user: otherUser,
        last_message: "",
        last_message_at: null,
        updated_at: new Date().toISOString(),
      });
      setMobileShowChat(true);
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim()) || !activeChat || !currentUser || sending) return;
    setSending(true);
    await apiPost("chats", "send", {
      chat_id: activeChat.id,
      sender_id: currentUser.user_id,
      content: newMessage.trim(),
    });
    setNewMessage("");
    setSending(false);
    await loadMessages(activeChat.id);
    await loadChats();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat || !currentUser) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("Файл слишком большой (макс 10 МБ)");
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const uploadData = await apiPost("upload", "", {
        file_data: base64,
        file_name: file.name,
        content_type: file.type,
      });

      if (uploadData.url) {
        await apiPost("chats", "send", {
          chat_id: activeChat.id,
          sender_id: currentUser.user_id,
          content: "",
          file_url: uploadData.url,
          file_name: file.name,
          file_type: file.type,
        });
        await loadMessages(activeChat.id);
        await loadChats();
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isImage = (fileType: string | null) => fileType?.startsWith("image/");

  if (!currentUser) return null;

  return (
    <div className="h-screen bg-neutral-900 flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={`w-full md:w-80 lg:w-96 bg-neutral-800 border-r border-neutral-700 flex flex-col ${
            mobileShowChat ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="p-4 border-b border-neutral-700">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-white font-bold text-lg">Messenger Bobs</h1>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSearch(!showSearch)}
                  className="text-neutral-400 hover:text-white hover:bg-neutral-700"
                >
                  <Icon name="UserPlus" size={20} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="text-neutral-400 hover:text-white hover:bg-neutral-700"
                >
                  <Icon name="LogOut" size={20} />
                </Button>
              </div>
            </div>
            {showSearch && (
              <div className="relative">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Найти пользователя..."
                  className="bg-neutral-700 border-neutral-600 text-white placeholder:text-neutral-500"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-neutral-700 rounded-lg mt-1 overflow-hidden z-20 shadow-xl">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => startChat(user)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-neutral-600 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-neutral-500 flex items-center justify-center text-white text-sm font-medium shrink-0">
                          {getInitials(user.display_name)}
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium">{user.display_name}</div>
                          <div className="text-neutral-400 text-xs">@{user.username}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {chats.length === 0 ? (
              <div className="p-6 text-center text-neutral-500">
                <Icon name="MessageCircle" size={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">Нет чатов</p>
                <p className="text-xs mt-1">Нажмите + чтобы найти собеседника</p>
              </div>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => {
                    setActiveChat(chat);
                    setMobileShowChat(true);
                  }}
                  className={`w-full flex items-center gap-3 p-4 transition-colors text-left ${
                    activeChat?.id === chat.id
                      ? "bg-neutral-700"
                      : "hover:bg-neutral-750 hover:bg-neutral-700/50"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-neutral-600 flex items-center justify-center text-white font-medium shrink-0">
                    {getInitials(chat.other_user.display_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="text-white text-sm font-medium truncate">
                        {chat.other_user.display_name}
                      </span>
                      <span className="text-neutral-500 text-xs ml-2 shrink-0">
                        {formatTime(chat.last_message_at)}
                      </span>
                    </div>
                    <p className="text-neutral-400 text-xs truncate mt-0.5">
                      {chat.last_message || "Нет сообщений"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-3 border-t border-neutral-700">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-neutral-600 flex items-center justify-center text-white text-xs font-medium">
                {getInitials(currentUser.display_name)}
              </div>
              <span className="text-neutral-400 text-sm truncate">{currentUser.display_name}</span>
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div
          className={`flex-1 flex flex-col ${
            !mobileShowChat ? "hidden md:flex" : "flex"
          }`}
        >
          {activeChat ? (
            <>
              <div className="p-4 border-b border-neutral-700 flex items-center gap-3 bg-neutral-800">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileShowChat(false)}
                  className="md:hidden text-neutral-400 hover:text-white hover:bg-neutral-700"
                >
                  <Icon name="ArrowLeft" size={20} />
                </Button>
                <div className="w-10 h-10 rounded-full bg-neutral-600 flex items-center justify-center text-white font-medium">
                  {getInitials(activeChat.other_user.display_name)}
                </div>
                <div>
                  <div className="text-white font-medium text-sm">
                    {activeChat.other_user.display_name}
                  </div>
                  <div className="text-neutral-500 text-xs">
                    @{activeChat.other_user.username}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                  const isMine = msg.sender_id === currentUser.user_id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          isMine
                            ? "bg-white text-neutral-900 rounded-br-md"
                            : "bg-neutral-700 text-white rounded-bl-md"
                        }`}
                      >
                        {msg.file_url && isImage(msg.file_type) && (
                          <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={msg.file_url}
                              alt={msg.file_name || "Image"}
                              className="max-w-full rounded-lg mb-1 max-h-64 object-cover"
                            />
                          </a>
                        )}
                        {msg.file_url && !isImage(msg.file_type) && (
                          <a
                            href={msg.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 mb-1 ${
                              isMine ? "text-neutral-600" : "text-neutral-300"
                            }`}
                          >
                            <Icon name="File" size={16} />
                            <span className="text-sm underline truncate">
                              {msg.file_name || "Файл"}
                            </span>
                          </a>
                        )}
                        {msg.content && (
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                        <p
                          className={`text-[10px] mt-1 ${
                            isMine ? "text-neutral-400" : "text-neutral-500"
                          }`}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-neutral-700 bg-neutral-800">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,.pdf,.doc,.docx,.zip,.rar,.txt"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-neutral-400 hover:text-white hover:bg-neutral-700 shrink-0"
                  >
                    {uploading ? (
                      <Icon name="Loader2" size={20} className="animate-spin" />
                    ) : (
                      <Icon name="Paperclip" size={20} />
                    )}
                  </Button>
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Написать сообщение..."
                    className="bg-neutral-700 border-neutral-600 text-white placeholder:text-neutral-500"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="bg-white text-black hover:bg-neutral-200 shrink-0"
                    size="icon"
                  >
                    {sending ? (
                      <Icon name="Loader2" size={18} className="animate-spin" />
                    ) : (
                      <Icon name="Send" size={18} />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-neutral-500">
                <Icon name="MessageSquare" size={64} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg">Выберите чат</p>
                <p className="text-sm mt-1">или найдите собеседника</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messenger;
