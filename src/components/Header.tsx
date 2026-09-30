import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, UserRole, ExamTrack, EXAM_TRACK_LABELS } from '../types';
import {
  GraduationCap,
  Flame,
  Award,
  Users,
  ShieldCheck,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Mail,
  User,
  LogOut,
  X,
  Play,
  FileText,
  Layers,
  Settings,
  HelpCircle,
  HardDrive,
  Code2,
  Globe,
  Compass,
} from 'lucide-react';
import { MemberAvatar } from './MemberAvatar';

interface HeaderProps {
  user: UserProfile;
  memberUsername?: string;
  memberAvatarUrl?: string | null;
  onSignOut: () => void;
  onRedeemTeacherInvitation: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenOwnProfile: () => void;
  onOpenAccountSettings: () => void;
  onOpenVideoModal?: () => void;
  onOpenGoogleWorkspace?: () => void;
  onOpenTrackModal?: () => void;
  onSelectTrack?: (track: ExamTrack) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  memberUsername,
  memberAvatarUrl,
  onSignOut,
  onRedeemTeacherInvitation,
  activeTab,
  onTabChange,
  onOpenOwnProfile,
  onOpenAccountSettings,
  onOpenVideoModal,
  onOpenGoogleWorkspace,
  onOpenTrackModal,
  onSelectTrack,
}) => {
  // Clean username format
  const userHandle = user.name ? user.name : (user.email ? user.email.split('@')[0] : 'Thành viên');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState(false);
  const [expandedAbout, setExpandedAbout] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileDrawerOpen]);

  const roleLabels: Record<UserRole, { label: string; desc: string; icon: string }> = {
    student: { label: 'Học sinh', desc: 'Luyện thi & thích ứng ZPD', icon: 'HS' },
    teacher: { label: 'Giáo viên', desc: 'Phân tích lớp & đề thi', icon: 'GV' },
    admin: { label: 'ADMIN', desc: 'Quản trị hệ thống', icon: 'AD' },
  };

  const handleNavClick = (tab: string) => {
    onTabChange(tab);
    setMobileDrawerOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="w-full max-w-[95%] 2xl:max-w-[1850px] mx-auto px-3 sm:px-5 lg:px-7">
          <div className="flex items-center justify-between h-14">
            {/* Left section: Hamburger button (Mobile) + Brand Logo */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* VNOI-style Cyan 3-bar Hamburger Button */}
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="lg:hidden flex flex-col justify-center items-center w-8 h-8 rounded bg-[#1e293b] hover:bg-[#0f172a] p-1.5 border border-[#334155] cursor-pointer transition focus:outline-hidden"
                aria-label="Mở menu điều hướng"
                title="Menu điều hướng"
              >
                <span className="block w-4 h-0.5 bg-blue-500 rounded-full mb-1"></span>
                <span className="block w-4 h-0.5 bg-blue-500 rounded-full mb-1"></span>
                <span className="block w-4 h-0.5 bg-blue-500 rounded-full"></span>
              </button>

              {/* Brand Logo - Variation 2 Style */}
              <button
                onClick={() => onTabChange('dashboard')}
                className="flex items-center space-x-2 text-left focus:outline-hidden cursor-pointer group"
              >
                {/* Brand logo tag >_ */}
                <div className="bg-[#1e293b] text-white font-mono font-extrabold text-sm px-2 py-0.5 rounded-xs tracking-tighter">
                  &gt;_
                </div>
                <div className="flex items-baseline">
                  <span className="font-bold text-sm sm:text-base tracking-tight uppercase text-[#1e293b]">
                    TinMaster
                  </span>
                  <span className="font-normal text-[11px] opacity-50 tracking-normal ml-1.5 text-slate-600 hidden xs:inline">
                    v2.4.0
                  </span>
                </div>
              </button>
            </div>

            {/* Desktop Navigation Links - Variation 2 Style */}
            <nav className="hidden lg:flex items-center gap-6 h-full">
              <button
                onClick={() => onTabChange('dashboard')}
                className={`text-xs font-semibold transition cursor-pointer flex items-center h-full border-b-2 pt-0.5 ${
                  activeTab === 'dashboard'
                    ? 'opacity-100 border-[#2563eb] text-[#1e293b] font-bold'
                    : 'opacity-70 hover:opacity-100 text-[#1e293b] border-transparent'
                }`}
              >
                Trang chủ
              </button>
              <button
                onClick={() => onTabChange('adaptive_practice')}
                className={`text-xs font-semibold transition cursor-pointer flex items-center h-full border-b-2 pt-0.5 ${
                  activeTab === 'adaptive_practice'
                    ? 'opacity-100 border-[#2563eb] text-[#1e293b] font-bold'
                    : 'opacity-70 hover:opacity-100 text-[#1e293b] border-transparent'
                }`}
              >
                Bài tập
              </button>
              <button
                onClick={() => onTabChange('exam_list')}
                className={`text-xs font-semibold transition cursor-pointer flex items-center h-full border-b-2 pt-0.5 ${
                  activeTab === 'exam_list' || activeTab === 'exam_simulation'
                    ? 'opacity-100 border-[#2563eb] text-[#1e293b] font-bold'
                    : 'opacity-70 hover:opacity-100 text-[#1e293b] border-transparent'
                }`}
              >
                Kỳ thi
              </button>
              <button
                onClick={() => onTabChange('knowledge_map')}
                className={`text-xs font-semibold transition cursor-pointer flex items-center h-full border-b-2 pt-0.5 ${
                  activeTab === 'knowledge_map'
                    ? 'opacity-100 border-[#2563eb] text-[#1e293b] font-bold'
                    : 'opacity-70 hover:opacity-100 text-[#1e293b] border-transparent'
                }`}
              >
                Lộ trình
              </button>
              <button
                onClick={() => onTabChange('member_directory')}
                className={`text-xs font-semibold transition cursor-pointer flex items-center h-full border-b-2 pt-0.5 ${
                  activeTab === 'member_directory' || activeTab === 'public_profile'
                    ? 'opacity-100 border-[#2563eb] text-[#1e293b] font-bold'
                    : 'opacity-70 hover:opacity-100 text-[#1e293b] border-transparent'
                }`}
              >
                Thành viên
              </button>
              {(user.role === 'teacher' || user.role === 'admin') && <button
                onClick={() => onTabChange('teacher_view')}
                className={`text-xs font-semibold transition cursor-pointer flex items-center h-full border-b-2 pt-0.5 ${
                  activeTab === 'teacher_view'
                    ? 'opacity-100 border-[#2563eb] text-[#1e293b] font-bold'
                    : 'opacity-70 hover:opacity-100 text-[#1e293b] border-transparent'
                }`}
              >
                Phân tích Lớp
              </button>}
              {user.role === 'admin' && (
                <>
                  <button
                    onClick={() => window.location.assign('/admin/dashboard')}
                    className="text-xs font-semibold transition cursor-pointer flex items-center h-full border-b-2 pt-0.5 opacity-70 hover:opacity-100 text-[#1e293b] border-transparent"
                  >
                    Quản lý hệ thống
                  </button>
                  <button
                    onClick={() => window.location.assign('/admin/setup-password')}
                    className="text-xs font-semibold transition cursor-pointer flex items-center h-full border-b-2 pt-0.5 opacity-70 hover:opacity-100 text-[#1e293b] border-transparent"
                  >
                    Thiết lập mật khẩu admin
                  </button>
                </>
              )}
              {onOpenVideoModal && (
                <button
                  onClick={onOpenVideoModal}
                  className="text-xs font-semibold text-[#2563eb] hover:opacity-100 opacity-80 flex items-center space-x-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-[#2563eb]" />
                  <span>AI Assistant</span>
                </button>
              )}
            </nav>

            {/* Right section: Variation 2 Stat Badges + Clean User Dropdown */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Variation 2 Stat Badges */}
              <div className="stat-badge flex items-center space-x-1" title="Chuỗi ngày học">
                <Flame className="w-3 h-3 fill-amber-500 text-amber-600 inline" />
                <span>{user.streakDays}d STREAK</span>
              </div>
              <div className="stat-badge text-[#2563eb]" title="Kinh nghiệm XP">
                <Award className="w-3 h-3 inline mr-1" />
                <span>{user.xp}XP</span>
              </div>

              {/* Registered Exam Track Badge for Student */}
              <button
                type="button"
                onClick={onOpenTrackModal}
                className={`stat-badge flex items-center space-x-1 cursor-pointer transition py-0.5 px-2 border ${
                  user.examTrack === 'CS'
                    ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                    : user.examTrack === 'ICT'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 animate-pulse'
                }`}
                title="Định hướng thi Tốt nghiệp THPT (24 trắc nghiệm + 2 Đúng/Sai tự chọn). Bấm để thay đổi."
              >
                {user.examTrack === 'CS' ? (
                  <Code2 className="w-3 h-3 text-purple-600 shrink-0" />
                ) : user.examTrack === 'ICT' ? (
                  <Globe className="w-3 h-3 text-emerald-600 shrink-0" />
                ) : (
                  <Compass className="w-3 h-3 text-amber-600 shrink-0" />
                )}
                <span className="font-semibold text-[11px]">
                  {user.examTrack === 'ICT'
                    ? 'Định hướng: Khoa học ứng dụng (ICT)'
                    : user.examTrack === 'CS'
                    ? 'Định hướng: Khoa học máy tính (CS)'
                    : 'Chọn định hướng (CS / Ứng dụng)'}
                </span>
              </button>

              {/* Clean User Dropdown Menu with 3 Roles & Gmail info */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  title="Tài khoản"
                  aria-expanded={dropdownOpen}
                >
                  <MemberAvatar name={user.name || userHandle} src={memberAvatarUrl !== undefined ? memberAvatarUrl : user.avatarUrl} size="sm" />
                  <div className="flex items-center space-x-1">
                    <span className="font-semibold text-xs text-[#1e293b] truncate max-w-[90px] sm:max-w-none">
                      {memberUsername ? `@${memberUsername}` : userHandle}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                      ({roleLabels[user.role].label})
                    </span>
                  </div>
                  <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Popover */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-1.5 w-64 bg-white rounded border border-[#d1d5db] shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Dropdown Header Card */}
                    <div className="p-3 bg-slate-50 text-slate-900 border-b border-slate-100">
                      <div className="flex items-center space-x-2.5">
                        <MemberAvatar name={user.name || userHandle} src={memberAvatarUrl !== undefined ? memberAvatarUrl : user.avatarUrl} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {user.name || userHandle}
                          </div>
                          <div className="mono text-[11px] text-slate-500 truncate flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section: Account Actions */}
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onOpenOwnProfile();
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        <span>Hồ sơ của tôi</span>
                      </button>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onOpenAccountSettings();
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-500" />
                        <span>Cài đặt tài khoản</span>
                      </button>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onRedeemTeacherInvitation();
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-[#f8fafc] flex items-center space-x-2 transition cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[#0066cc]" />
                        <span>Nhập mã mời giáo viên</span>
                      </button>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onSignOut();
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2 transition cursor-pointer border-t border-slate-100"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Đổi tài khoản / Đăng xuất</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* VNOI-STYLE SLIDE-OUT LEFT SIDEBAR DRAWER (FOR MOBILE & TABLET)           */}
      {/* ========================================================================= */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer Panel (Dark Matte Judge Aesthetic matching IMG_1730) */}
          <div className="relative w-[280px] sm:w-[320px] max-w-[85vw] bg-white text-slate-700 h-full shadow-2xl flex flex-col z-50 border-r border-slate-200 animate-in slide-in-from-left duration-200 overflow-y-auto">
            {/* Drawer Header with Cyan Accent & Close */}
            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="flex flex-col space-y-0.75 w-5">
                  <span className="block w-5 h-0.75 bg-blue-600 rounded"></span>
                  <span className="block w-5 h-0.75 bg-blue-600 rounded"></span>
                  <span className="block w-5 h-0.75 bg-blue-600 rounded"></span>
                </div>
                <div>
                  <div className="mono font-black text-slate-800 text-base tracking-wider">
                    TIN<span className="text-blue-600">_MASTER</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    OJ & Adaptive Learning
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
                aria-label="Đóng menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick User Card in Drawer */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <MemberAvatar name={user.name || userHandle} src={memberAvatarUrl !== undefined ? memberAvatarUrl : user.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-slate-900 truncate flex items-center gap-1.5">
                    <span>{userHandle}</span>
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-100">
                      {roleLabels[user.role].icon}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate mono flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                </div>
              </div>

              {/* Quick Gamification stats inside drawer */}
              <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-xs mono">
                <div className="flex items-center space-x-1 text-amber-700">
                  <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-400" />
                  <span>Chuỗi: {user.streakDays} ngày</span>
                </div>
                <div className="flex items-center space-x-1 text-blue-700">
                  <Award className="w-3.5 h-3.5" />
                  <span>Điểm: {user.xp} XP</span>
                </div>
              </div>
            </div>

            {/* Navigation Menu (Replicating exact VNOI uppercase list from IMG_1730) */}
            <nav className="flex-1 py-2 px-1 text-sm font-sans divide-y divide-slate-100">
              <div className="py-1">
                {/* 1. HOME */}
                <button
                  onClick={() => handleNavClick('dashboard')}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded text-left transition cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'text-blue-700 bg-blue-50 font-bold border-l-3 border-blue-600'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="tracking-wider">HOME</span>
                  <span className="text-xs text-slate-500">Trang chủ</span>
                </button>

                {/* 2. PROBLEMS */}
                <button
                  onClick={() => handleNavClick('adaptive_practice')}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded text-left transition cursor-pointer ${
                    activeTab === 'adaptive_practice'
                      ? 'text-blue-700 bg-blue-50 font-bold border-l-3 border-blue-600'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="tracking-wider">PROBLEMS</span>
                  <span className="text-xs text-slate-500">Bài tập ZPD</span>
                </button>

                {/* 3. CONTESTS */}
                <button
                  onClick={() => handleNavClick('exam_list')}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded text-left transition cursor-pointer ${
                    activeTab === 'exam_list' || activeTab === 'exam_simulation'
                      ? 'text-blue-700 bg-blue-50 font-bold border-l-3 border-blue-600'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="tracking-wider">CONTESTS</span>
                  <span className="text-xs text-slate-500">Thi 50 phút</span>
                </button>

                {/* 4. SUBMISSIONS */}
                <button
                  onClick={() => handleNavClick('exam_review')}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded text-left transition cursor-pointer ${
                    activeTab === 'exam_review'
                      ? 'text-blue-700 bg-blue-50 font-bold border-l-3 border-blue-600'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="tracking-wider">SUBMISSIONS</span>
                  <span className="text-xs text-slate-500">Lịch sử bài làm</span>
                </button>
                {(user.role === 'teacher' || user.role === 'admin') && (
                  <button
                    onClick={() => handleNavClick('teacher_view')}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <span className="tracking-wider">TEACHER</span>
                    <span className="text-xs text-slate-500">Phân tích lớp</span>
                  </button>
                )}
                {user.role === 'admin' && (
                  <>
                    <button
                      onClick={() => window.location.assign('/admin/dashboard')}
                      className="w-full flex items-center justify-between px-4 py-2.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                    >
                      <span className="tracking-wider">ADMIN</span>
                      <span className="text-xs text-slate-500">Quản lý hệ thống</span>
                    </button>
                    <button
                      onClick={() => window.location.assign('/admin/setup-password')}
                      className="w-full flex items-center justify-between px-4 py-2.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                    >
                      <span className="tracking-wider">PASSWORD</span>
                      <span className="text-xs text-slate-500">Thiết lập hoặc đổi</span>
                    </button>
                  </>
                )}
              </div>

              {/* 5. USERS > (role is read-only and sourced from Supabase) */}
              <div className="py-1">
                <button
                  onClick={() => setExpandedUsers(!expandedUsers)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                >
                  <span className="tracking-wider font-bold text-slate-800 flex items-center gap-1.5">
                    USERS
                    <span className="text-[10px] text-blue-700">({roleLabels[user.role].label})</span>
                  </span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedUsers ? 'rotate-90 text-blue-600' : ''}`} />
                </button>

                {expandedUsers && (
                  <div className="bg-slate-50 my-1 rounded border border-slate-200 px-4 py-3 text-xs text-slate-600">
                    Vai trò được xác thực: <strong>{roleLabels[user.role].label}</strong>
                  </div>
                )}

                {/* 6. WIKI */}
                <button
                  onClick={() => handleNavClick('knowledge_map')}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded text-left transition cursor-pointer ${
                    activeTab === 'knowledge_map'
                      ? 'text-blue-700 bg-blue-50 font-bold border-l-3 border-blue-600'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="tracking-wider">WIKI</span>
                  <span className="text-xs text-slate-500">Lộ trình & Kiến thức</span>
                </button>
                <button
                  onClick={() => handleNavClick('member_directory')}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded text-left transition cursor-pointer ${
                    activeTab === 'member_directory' || activeTab === 'public_profile'
                      ? 'text-blue-700 bg-blue-50 font-bold border-l-3 border-blue-600'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="tracking-wider">MEMBERS</span>
                  <span className="text-xs text-slate-500">Thành viên</span>
                </button>

                {/* 7. ABOUT > (Expandable like VNOI) */}
                <button
                  onClick={() => setExpandedAbout(!expandedAbout)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                >
                  <span className="tracking-wider">ABOUT</span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedAbout ? 'rotate-90 text-blue-600' : ''}`} />
                </button>

                {expandedAbout && (
                  <div className="bg-slate-50 my-1 p-3 rounded border border-slate-200 text-xs text-slate-600 space-y-2">
                    <p className="font-semibold text-slate-800">
                      TinMaster Adaptive Learning Engine
                    </p>
                    <p className="leading-relaxed">
                      Ứng dụng mô hình Bayesian Knowledge Tracing (BKT) và vùng phát triển gần (ZPD) theo cấu trúc Đề thi Tốt nghiệp THPT 2025 của Bộ GD&ĐT.
                    </p>
                    <div className="pt-1 text-[11px] text-blue-700 mono flex items-center gap-1">
                      <Code2 className="w-3 h-3" />
                      <span>Version 1.0.4 • BGDĐT 2025</span>
                    </div>
                  </div>
                )}

                {/* 8. TẠP CHÍ / TÀI LIỆU */}
                {onOpenGoogleWorkspace && (
                  <button
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      onOpenGoogleWorkspace();
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <span className="tracking-wider">TẠP CHÍ</span>
                    <span className="text-xs text-slate-500">Xuất Google Docs</span>
                  </button>
                )}

                {/* AI Assistant Button in Drawer */}
                {onOpenVideoModal && (
                  <button
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      onOpenVideoModal();
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded text-left text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                  >
                    <span className="tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" />
                      VIDEO BÀI GIẢNG AI
                    </span>
                    <span className="text-xs text-[#38bdf8]">3 phút</span>
                  </button>
                )}
              </div>
            </nav>

            {/* Bottom Actions: Log in / Sign up / Switch Gmail */}
            <div className="p-3 border-t border-slate-200 bg-white space-y-2">
              <button
                onClick={() => {
                  setMobileDrawerOpen(false);
                  onOpenOwnProfile();
                }}
                className="w-full py-2 px-3 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md text-xs font-semibold flex items-center justify-center space-x-2"
              >
                <User className="w-3.5 h-3.5" />
                <span>Hồ sơ của tôi</span>
              </button>
              <button
                onClick={() => {
                  setMobileDrawerOpen(false);
                  onOpenAccountSettings();
                }}
                className="w-full py-2 px-3 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md text-xs font-semibold flex items-center justify-center space-x-2"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Cài đặt tài khoản</span>
              </button>
              <button
                onClick={() => {
                  setMobileDrawerOpen(false);
                  onRedeemTeacherInvitation();
                }}
                className="w-full py-2 px-3 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md text-xs font-semibold flex items-center justify-center space-x-2"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Nhập mã mời giáo viên</span>
              </button>
              <button
                onClick={() => {
                  setMobileDrawerOpen(false);
                  onSignOut();
                }}
                className="w-full py-2 px-3 bg-red-700 hover:bg-red-600 text-white rounded text-xs font-bold flex items-center justify-center space-x-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 px-1">
                <span>© 2025 TinMaster OJ</span>
                <span className="text-blue-600 mono">TINMASTER</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
