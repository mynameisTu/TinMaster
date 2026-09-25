export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  school: string;
  avatarText: string;
  avatarColor: string;
  xp: number;
  streakDays: number;
  accuracyPercent: number;
  isCurrentUser?: boolean;
}

export const TOP_LEADERBOARD_USERS: LeaderboardEntry[] = [
  {
    id: 'user_rank_1',
    rank: 1,
    name: 'Trần Minh Nhật',
    school: 'THPT Chuyên Hà Nội - Amsterdam',
    avatarText: 'MN',
    avatarColor: 'bg-amber-100 text-amber-800 border-amber-300',
    xp: 1420,
    streakDays: 14,
    accuracyPercent: 92,
  },
  {
    id: 'user_rank_2',
    rank: 2,
    name: 'Lê Thu Hà',
    school: 'THPT Chuyên Lê Hồng Phong (TP.HCM)',
    avatarText: 'TH',
    avatarColor: 'bg-slate-200 text-slate-800 border-slate-400',
    xp: 1280,
    streakDays: 12,
    accuracyPercent: 88,
  },
  {
    id: 'user_rank_3',
    rank: 3,
    name: 'Nguyễn Hoàng Long',
    school: 'THPT Chuyên Quốc Học Huế',
    avatarText: 'HL',
    avatarColor: 'bg-amber-50 text-amber-900 border-amber-400',
    xp: 1150,
    streakDays: 10,
    accuracyPercent: 86,
  },
  {
    id: 'user_rank_4',
    rank: 4,
    name: 'Vũ Diệu Linh',
    school: 'THPT Chuyên Lam Sơn (Thanh Hóa)',
    avatarText: 'DL',
    avatarColor: 'bg-blue-100 text-blue-800 border-blue-200',
    xp: 980,
    streakDays: 9,
    accuracyPercent: 84,
  },
  {
    id: 'user_rank_5',
    rank: 5,
    name: 'Phạm Quốc Đạt',
    school: 'THPT Chu Văn An (Hà Nội)',
    avatarText: 'QĐ',
    avatarColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    xp: 860,
    streakDays: 8,
    accuracyPercent: 81,
  },
  {
    id: 'user_rank_6',
    rank: 6,
    name: 'Đỗ Phương Anh',
    school: 'THPT Chuyên Khoa học Tự nhiên',
    avatarText: 'PA',
    avatarColor: 'bg-purple-100 text-purple-800 border-purple-200',
    xp: 740,
    streakDays: 7,
    accuracyPercent: 79,
  },
  {
    id: 'user_rank_7',
    rank: 7,
    name: 'Hoàng Tuấn Kiệt',
    school: 'THPT Chuyên Phan Bội Châu (Nghệ An)',
    avatarText: 'TK',
    avatarColor: 'bg-sky-100 text-sky-800 border-sky-200',
    xp: 620,
    streakDays: 6,
    accuracyPercent: 76,
  },
];
