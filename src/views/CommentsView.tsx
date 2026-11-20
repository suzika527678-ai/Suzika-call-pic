import React, { useState } from 'react';
import { MessageSquareHeart, Heart, Send, Reply, Sparkles, Smile } from 'lucide-react';
import { CommunityComment, UserProfile, AppBannerConfig } from '../types';
import { soundFX } from '../utils/audio';
import { AdBanner } from '../components/AdBanner';

interface CommentsViewProps {
  comments: CommunityComment[];
  userProfile: UserProfile;
  onAddComment: (content: string, category: 'General' | 'Photo' | 'Video' | 'VIP') => void;
  onToggleCommentLike: (commentId: string) => void;
  onAddReply: (commentId: string, replyText: string) => void;
  bannerConfig?: AppBannerConfig;
  onRequireLogin?: () => void;
}

export const CommentsView: React.FC<CommentsViewProps> = ({
  comments,
  userProfile,
  onAddComment,
  onToggleCommentLike,
  onAddReply,
  bannerConfig,
  onRequireLogin,
}) => {
  const [commentText, setCommentText] = useState('');
  const [category, setCategory] = useState<'General' | 'Photo' | 'Video' | 'VIP'>('General');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filterTag, setFilterTag] = useState<string>('All');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.isLoggedIn || !userProfile?.phone) {
      soundFX.playPop();
      if (onRequireLogin) onRequireLogin();
      return;
    }
    if (!commentText.trim()) return;
    soundFX.playSuccess();
    onAddComment(commentText.trim(), category);
    setCommentText('');
  };

  const handleReplySubmit = (commentId: string) => {
    if (!userProfile?.isLoggedIn || !userProfile?.phone) {
      soundFX.playPop();
      if (onRequireLogin) onRequireLogin();
      return;
    }
    if (!replyText.trim()) return;
    soundFX.playSuccess();
    onAddReply(commentId, replyText.trim());
    setReplyText('');
    setActiveReplyId(null);
  };

  const filteredComments = comments.filter((c) => {
    if (filterTag === 'All') return true;
    return c.category === filterTag;
  });

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="pb-2 border-b border-[#252a3d]">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-bold text-white">Community Comments</h1>
          <span className="text-[11px] font-mono-numbers px-2 py-0.5 rounded-full bg-[#ff35bb]/15 border border-[#ff35bb]/30 text-[#ff8ce4] font-bold">
            {comments.length} Posts
          </span>
        </div>
        <p className="text-xs text-[#9da4b8] mt-0.5">
          Share your feedback, request photo/video genres, and chat with members.
        </p>
      </div>

      {/* Top Google Ad Banner */}
      <AdBanner slotName="comments-top" format="banner" config={bannerConfig} />

      {/* Post a Comment Card */}
      {!userProfile?.isLoggedIn ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#ff35bb]/15 via-[#8b4dff]/15 to-[#00d2ff]/15 border border-[#ff35bb]/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-lg">
          <div>
            <h3 className="text-xs font-bold text-white">কমেন্ট ও লাইক দিতে একাউন্টে লগইন করুন</h3>
            <p className="text-[11px] text-[#d5cce7] mt-0.5">লগইন করলে আপনি যে কোনো পোস্টে লাইক ও মতামত দিতে পারবেন।</p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              if (onRequireLogin) onRequireLogin();
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] text-white text-xs font-bold shadow-md hover:opacity-95 active:scale-95 transition-all shrink-0"
          >
            লগইন করুন (Login)
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-[#111522] border border-[#252a3d] shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff35bb] to-[#8b4dff] flex items-center justify-center font-bold text-white text-xs">
              {userProfile.avatarText || userProfile.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <span className="text-xs font-bold text-white">{userProfile.name}</span>
              <p className="text-[10px] text-[#9da4b8]">Posting to SUZIKA Community</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2.5">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write something kind or share what photos you want next..."
              rows={3}
              className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl p-3 text-xs text-white placeholder-[#9da4b8]/50 focus:outline-none resize-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-[#9da4b8] mr-1">Topic:</span>
                {(['General', 'Photo', 'Video', 'VIP'] as const).map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors ${
                      category === cat
                        ? 'bg-[#ff35bb] text-white font-bold'
                        : 'bg-[#181d30] text-[#9da4b8] hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={!commentText.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold disabled:opacity-40 hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-[#ff35bb]/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post Comment</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {['All', 'General', 'Photo', 'Video', 'VIP'].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              soundFX.playPop();
              setFilterTag(tab);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filterTag === tab
                ? 'bg-[#202742] text-white border border-[#ff35bb]/40'
                : 'bg-[#111522] text-[#9da4b8] hover:text-white border border-[#252a3d]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Community Ad Banner */}
      <AdBanner slotName="comments-banner" format="banner" config={bannerConfig} />

      {/* Comments List */}
      <div className="space-y-3">
        {filteredComments.map((comment) => (
          <div
            key={comment.id}
            className="p-4 rounded-2xl bg-[#111522] border border-[#252a3d] hover:border-[#353c58] transition-colors"
          >
            {/* Comment Author Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${comment.avatarColor} flex items-center justify-center font-bold text-white text-xs shadow-sm`}>
                  {comment.authorAvatarText}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{comment.authorName}</span>
                    {comment.category && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#1e243b] text-[#00d2ff] font-mono-numbers">
                        {comment.category}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#9da4b8]">{comment.timestamp}</span>
                </div>
              </div>

              {/* Like Comment */}
              <button
                onClick={() => {
                  if (!userProfile?.isLoggedIn || !userProfile?.phone) {
                    soundFX.playPop();
                    if (onRequireLogin) onRequireLogin();
                    return;
                  }
                  soundFX.playHeart();
                  onToggleCommentLike(comment.id);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono-numbers transition-colors ${
                  comment.isLiked
                    ? 'text-[#ff35bb] bg-[#ff35bb]/10 font-bold'
                    : 'text-[#9da4b8] hover:text-white hover:bg-[#161a2b]'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${comment.isLiked ? 'fill-[#ff35bb]' : ''}`} />
                <span>{comment.likes}</span>
              </button>
            </div>

            {/* Comment Content */}
            <p className="text-xs text-[#e1dbed] leading-relaxed pl-10 mb-2">
              {comment.content}
            </p>

            {/* Reply Action Trigger */}
            <div className="pl-10 flex items-center gap-3 text-[11px]">
              <button
                onClick={() => {
                  if (!userProfile?.isLoggedIn || !userProfile?.phone) {
                    soundFX.playPop();
                    if (onRequireLogin) onRequireLogin();
                    return;
                  }
                  soundFX.playPop();
                  setActiveReplyId(activeReplyId === comment.id ? null : comment.id);
                }}
                className="flex items-center gap-1 text-[#9da4b8] hover:text-[#ff35bb] font-medium"
              >
                <Reply className="w-3 h-3" />
                <span>Reply</span>
              </button>
            </div>

            {/* Nested Replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="mt-3 ml-10 space-y-2 border-l-2 border-[#252a3d] pl-3">
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="bg-[#151a2d] p-2.5 rounded-xl border border-[#252a3d]/80 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-[11px] flex items-center gap-1">
                        {reply.authorName}
                        {reply.authorName.includes('Admin') && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-[#ff35bb]/20 text-[#ff35bb] font-bold">
                            STAFF
                          </span>
                        )}
                      </span>
                      <span className="text-[9px] text-[#9da4b8]">{reply.timestamp}</span>
                    </div>
                    <p className="text-[#d5cce7] leading-relaxed text-[11px]">{reply.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Inline Reply Input */}
            {activeReplyId === comment.id && (
              <div className="mt-3 ml-10 pt-2 border-t border-[#252a3d] flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${comment.authorName}...`}
                  autoFocus
                  className="flex-1 bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-1.5 text-xs text-white placeholder-[#9da4b8]/50 focus:outline-none"
                />
                <button
                  onClick={() => handleReplySubmit(comment.id)}
                  disabled={!replyText.trim()}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white text-xs font-bold disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Ad Banner */}
      <AdBanner slotName="comments-bottom" format="banner" config={bannerConfig} />
    </div>
  );
};
