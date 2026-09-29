import React from 'react';
import { BookOpen, HardDrive, Sparkles } from 'lucide-react';

interface TeacherDashboardProps {
  onOpenVideoModal?: () => void;
  onOpenGoogleWorkspace?: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onOpenVideoModal,
  onOpenGoogleWorkspace,
}) => (
  <section className="mx-auto max-w-5xl space-y-5 pb-12">
    <header>
      <h1 className="text-xl font-semibold text-slate-900">Lớp học</h1>
      <p className="mt-1 text-sm text-slate-500">Quản lý lớp và hoạt động học tập của học sinh.</p>
    </header>

    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-10 text-center shadow-xs">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <BookOpen className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold text-slate-900">Chưa có lớp học</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        Lớp học, học sinh và báo cáo sẽ xuất hiện tại đây sau khi được kết nối.
      </p>
    </div>

    {(onOpenVideoModal || onOpenGoogleWorkspace) && (
      <div className="flex flex-wrap gap-2">
        {onOpenVideoModal && (
          <button onClick={onOpenVideoModal} className="btn-secondary text-sm">
            <Sparkles className="h-4 w-4" />
            Tạo bài giảng AI
          </button>
        )}
        {onOpenGoogleWorkspace && (
          <button onClick={onOpenGoogleWorkspace} className="btn-secondary text-sm">
            <HardDrive className="h-4 w-4" />
            Google Workspace
          </button>
        )}
      </div>
    )}
  </section>
);
