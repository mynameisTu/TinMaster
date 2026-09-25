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
  Check,
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

interface HeaderProps {
  user: UserProfile;
  onRoleChange: (role: UserRole) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenVideoModal?: () => void;
  onOpenGoogleSignIn?: () => void;
  onOpenGoogleWorkspace?: () => void;
  onOpenTrackModal?: () => void;
  onSelectTrack?: (track: ExamTrack) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onRoleChange,
  activeTab,
  onTabChange,
  onOpenVideoModal,
  onOpenGoogleSignIn,
  onOpenGoogleWorkspace,
  onOpenTrackModal,
  onSelectTrack,
}) => {
  // Clean username format
  const userHandle = user.name ? user.name : (user.email ? user.email.split('@')[0] : 'Ngoc Tu');
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
      <header className="sticky top-0 z-40 bg-white border-b-[1.5px] border-[#1e293b] shadow-xs">
        <div className="w-full max-w-[95%] 2xl:max-w-[1850px] mx-auto px-3 sm:px-5 lg:px-7">
          <div className="flex items-center justify-between h-12">
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
                <span className="block w-4 h-0.5 bg-[#00e599] rounded-full mb-1"></span>
                <span className="block w-4 h-0.5 bg-[#00e599] rounded-full mb-1"></span>
                <span className="block w-4 h-0.5 bg-[#00e599] rounded-full"></span>
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
                onClick={() => onTabChange('teacher_view')}
                className={`text-xs font-semibold transition cursor-pointer flex items-center h-full border-b-2 pt-0.5 ${
                  activeTab === 'teacher_view'
                    ? 'opacity-100 border-[#2563eb] text-[#1e293b] font-bold'
                    : 'opacity-70 hover:opacity-100 text-[#1e293b] border-transparent'
                }`}
              >
                Phân tích Lớp
              </button>
              {user.role === 'admin' && (
                <button
                  onClick={() => onTabChange('research_admin')}
                  className={`text-xs font-semibold transition cursor-pointer flex items-center h-full border-b-2 pt-0.5 ${
                    activeTab === 'research_admin'
                      ? 'opacity-100 border-[#2563eb] text-[#1e293b] font-bold'
                      : 'opacity-70 hover:opacity-100 text-[#1e293b] border-transparent'
                  }`}
                >
                  Quản lý hệ thống
                </button>
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
                  className="flex items-center space-x-1.5 bg-[#f8fafc] hover:bg-[#f1f5f9] px-2 py-1 rounded border border-[#e2e8f0] transition cursor-pointer text-left focus:outline-hidden"
                  title="Tài khoản & Vai trò"
                >
                  <div className="w-5 h-5 rounded bg-[#1e293b] text-white flex items-center justify-center font-mono font-bold text-[9px] overflow-hidden">
                    <span className="text-[#00e599]">■</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="font-semibold text-xs text-[#1e293b] truncate max-w-[90px] sm:max-w-none">
                      {userHandle}
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
                    <div className="p-3 bg-[#2b2b2b] text-white border-b border-[#3b3b3b]">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded bg-[#1f2937] border border-[#00e599] flex items-center justify-center text-sm font-bold text-[#00e599] font-mono">
                          ■
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-white truncate">
                            Xin chào, <span className="text-white font-bold">{user.name || userHandle}</span>
                          </div>
                          <div className="mono text-[11px] text-slate-300 truncate flex items-center gap-1">
                            <Mail className="w-3 h-3 text-[#00e599] shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section: Select Role */}
                    <div className="py-1.5 border-b border-[#e5e7eb]">
                      <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                        Chuyển đổi vai trò:
                      </div>

                      {(['student', 'teacher', 'admin'] as UserRole[]).map((r) => {
                        const isActive = user.role === r;
                        return (
                          <button
                            key={r}
                            onClick={() => {
                              onRoleChange(r);
                              setDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 flex items-center justify-between transition cursor-pointer ${
                              isActive
                                ? 'bg-[#f0f7ff] text-[#0066cc] font-semibold border-l-3 border-[#0066cc]'
                                : 'text-slate-700 hover:bg-[#f8fafc]'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <span className={`mono text-xs px-1.5 py-0.5 rounded font-bold ${
                                isActive ? 'bg-[#0066cc] text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {roleLabels[r].icon}
                              </span>
                              <div>
                                <div className="text-xs font-semibold">{roleLabels[r].label}</div>
                                <div className="text-[10px] text-slate-500">{roleLabels[r].desc}</div>
                              </div>
                            </div>
                            {isActive && <Check className="w-4 h-4 text-[#0066cc]" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Section: Account Actions */}
                    <div className="py-1">
                      {onOpenGoogleSignIn && (
                        <button
                          onClick={() => {
                            setDropdownOpen(false);
                            onOpenGoogleSignIn();
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-[#f8fafc] flex items-center space-x-2 transition cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5 text-[#0066cc]" />
                          <span>Đăng nhập Gmail khác</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          if (onOpenGoogleSignIn) onOpenGoogleSignIn();
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
          <div className="relative w-[280px] sm:w-[320px] max-w-[85vw] bg-[#1a1e24] text-slate-200 h-full shadow-2xl flex flex-col z-50 border-r border-[#2d333b] animate-in slide-in-from-left duration-200 overflow-y-auto">
            {/* Drawer Header with Cyan Accent & Close */}
            <div className="p-4 border-b border-[#2d333b] bg-[#16191f] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="flex flex-col space-y-0.75 w-5">
                  <span className="block w-5 h-0.75 bg-[#00e599] rounded"></span>
                  <span className="block w-5 h-0.75 bg-[#00e599] rounded"></span>
                  <span className="block w-5 h-0.75 bg-[#00e599] rounded"></span>
                </div>
                <div>
                  <div className="mono font-black text-white text-base tracking-wider">
                    TIN<span className="text-[#00e599]">_MASTER</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    OJ & Adaptive Learning
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="w-8 h-8 rounded bg-[#232832] text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                aria-label="Đóng menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick User Card in Drawer */}
            <div className="p-3.5 bg-[#20252e] border-b border-[#2d333b]">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded bg-[#12151a] border border-[#00e599] flex items-center justify-center text-sm font-bold text-[#00e599] font-mono shrink-0">
                  ■
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                    <span>{userHandle}</span>
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#00e599]/20 text-[#00e599] border border-[#00e599]/30">
                      {roleLabels[user.role].icon}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate mono flex items-center gap-1">
                    <Mail className="w-3 h-3 text-[#00e599] shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                </div>
              </div>

              {/* Quick Gamification stats inside drawer */}
              <div className="mt-2.5 pt-2 border-t border-[#2d333b] flex items-center justify-between text-xs mono">
                <div className="flex items-center space-x-1 text-amber-400">
                  <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-400" />
                  <span>Chuỗi: {user.streakDays} ngày</span>
                </div>
                <div className="flex items-center space-x-1 text-[#38bdf8]">
                  <Award className="w-3.5 h-3.5" />
                  <span>Điểm: {user.xp} XP</span>
                </div>
              </div>
            </div>

            {/* Navigation Menu (Replicating exact VNOI uppercase list from IMG_1730) */}
            <nav className="flex-1 py-2 px-1 text-sm font-sans divide-y divide-[#232832]">
              <div className="py-1">
                {/* 1. HOME */}
                <button
                  onClick={() => handleNavClick('dashboard')}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded text-left transition cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'text-[#00e599] bg-[#232934] font-bold border-l-3 border-[#00e599]'
                      : 'text-slate-300 hover:text-white hover:bg-[#20252e]'
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
                      ? 'text-[#00e599] bg-[#232934] font-bold border-l-3 border-[#00e599]'
                      : 'text-slate-300 hover:text-white hover:bg-[#20252e]'
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
                      ? 'text-[#00e599] bg-[#232934] font-bold border-l-3 border-[#00e599]'
                      : 'text-slate-300 hover:text-white hover:bg-[#20252e]'
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
                      ? 'text-[#00e599] bg-[#232934] font-bold border-l-3 border-[#00e599]'
                      : 'text-slate-300 hover:text-white hover:bg-[#20252e]'
                  }`}
                >
                  <span className="tracking-wider">SUBMISSIONS</span>
                  <span className="text-xs text-slate-500">Lịch sử bài làm</span>
                </button>
              </div>

              {/* 5. USERS > (Expandable like VNOI) */}
              <div className="py-1">
                <button
                  onClick={() => setExpandedUsers(!expandedUsers)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded text-left text-slate-300 hover:text-white hover:bg-[#20252e] transition cursor-pointer"
                >
                  <span className="tracking-wider font-bold text-white flex items-center gap-1.5">
                    USERS
                    <span className="text-[10px] text-[#00e599]">({roleLabels[user.role].label})</span>
                  </span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedUsers ? 'rotate-90 text-[#00e599]' : ''}`} />
                </button>

                {expandedUsers && (
                  <div className="bg-[#14171d] my-1 rounded border border-[#2d333b] overflow-hidden">
                    {(['student', 'teacher', 'admin'] as UserRole[]).map((r) => {
                      const isActive = user.role === r;
                      return (
                        <button
                          key={r}
                          onClick={() => {
                            onRoleChange(r);
                            if (r === 'teacher') handleNavClick('teacher_view');
                            else if (r === 'admin') handleNavClick('research_admin');
                            else handleNavClick('dashboard');
                          }}
                          className={`w-full text-left px-3.5 py-2 flex items-center justify-between text-xs transition cursor-pointer ${
                            isActive
                              ? 'bg-[#1e2530] text-[#00e599] font-bold'
                              : 'text-slate-400 hover:text-white hover:bg-[#191d24]'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] mono px-1 py-0.5 rounded bg-[#232832] text-slate-300">
                              {roleLabels[r].icon}
                            </span>
                            <span>{roleLabels[r].label}</span>
                          </div>
                          {isActive && <Check className="w-3.5 h-3.5 text-[#00e599]" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 6. WIKI */}
                <button
                  onClick={() => handleNavClick('knowledge_map')}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded text-left transition cursor-pointer ${
                    activeTab === 'knowledge_map'
                      ? 'text-[#00e599] bg-[#232934] font-bold border-l-3 border-[#00e599]'
                      : 'text-slate-300 hover:text-white hover:bg-[#20252e]'
                  }`}
                >
                  <span className="tracking-wider">WIKI</span>
                  <span className="text-xs text-slate-500">Lộ trình & Kiến thức</span>
                </button>

                {/* 7. ABOUT > (Expandable like VNOI) */}
                <button
                  onClick={() => setExpandedAbout(!expandedAbout)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded text-left text-slate-300 hover:text-white hover:bg-[#20252e] transition cursor-pointer"
                >
                  <span className="tracking-wider">ABOUT</span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedAbout ? 'rotate-90 text-[#00e599]' : ''}`} />
                </button>

                {expandedAbout && (
                  <div className="bg-[#14171d] my-1 p-3 rounded border border-[#2d333b] text-xs text-slate-400 space-y-2">
                    <p className="font-semibold text-slate-200">
                      TinMaster Adaptive Learning Engine
                    </p>
                    <p className="leading-relaxed">
                      Ứng dụng mô hình Bayesian Knowledge Tracing (BKT) và vùng phát triển gần (ZPD) theo cấu trúc Đề thi Tốt nghiệp THPT 2025 của Bộ GD&ĐT.
                    </p>
                    <div className="pt-1 text-[11px] text-[#00e599] mono flex items-center gap-1">
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
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded text-left text-slate-300 hover:text-white hover:bg-[#20252e] transition cursor-pointer"
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
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded text-left text-[#38bdf8] hover:bg-[#20252e] transition cursor-pointer"
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
            <div className="p-3 border-t border-[#2d333b] bg-[#16191f] space-y-2">
              {onOpenGoogleSignIn ? (
                <button
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    onOpenGoogleSignIn();
                  }}
                  className="w-full py-2 px-3 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded text-xs font-bold font-sans flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Đăng nhập Gmail (@gmail.com)</span>
                </button>
              ) : null}

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 px-1">
                <span>© 2025 TinMaster OJ</span>
                <span className="text-[#00e599] mono">ONLINE ●</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
