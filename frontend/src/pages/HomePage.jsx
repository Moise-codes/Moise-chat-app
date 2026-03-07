import { useChatStore } from "../store/useChatStore";
import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
  const { selectedUser } = useChatStore();

  return (
    <div className="h-screen bg-base-200">
      <div className="flex items-center justify-center pt-16 px-0 sm:px-4 sm:pt-20">
        <div className="bg-base-100 rounded-none sm:rounded-lg shadow-cl w-full max-w-6xl h-[calc(100vh-4rem)] sm:h-[calc(100vh-8rem)]">
          <div className="flex h-full rounded-none sm:rounded-lg overflow-hidden">
            {/* On mobile: hide sidebar when a user is selected, hide chat when no user selected */}
            <div className={`${selectedUser ? "hidden sm:flex" : "flex"} w-full sm:w-auto`}>
              <Sidebar />
            </div>
            <div className={`${!selectedUser ? "hidden sm:flex" : "flex"} flex-1`}>
              {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;