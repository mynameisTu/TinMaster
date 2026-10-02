import React, { useState } from 'react';
import { ConceptNode, StudentMastery, CurriculumStrand, STRAND_LABELS } from '../types';
import { CONCEPTS_LIST } from '../data/curriculumData';
import { getVerifiedMastery } from '../services/masteryStorage';
import {
  BrainCircuit,
  Database,
  Globe,
  Network,
  Code2,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Play,
  RotateCcw,
  Calendar,
  Layers,
} from 'lucide-react';

interface KnowledgeMapProps {
  masteries: Record<string, StudentMastery>;
  onStartPracticeConcept: (conceptId: string) => void;
  onOpenVideoModal: (conceptId: string) => void;
}

export const KnowledgeMap: React.FC<KnowledgeMapProps> = ({
  masteries,
  onStartPracticeConcept,
  onOpenVideoModal,
}) => {
  const [selectedStrand, setSelectedStrand] = useState<CurriculumStrand | 'ALL'>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<number | 'ALL'>('ALL');

  const filteredConcepts = CONCEPTS_LIST.filter((c) => {
    if (selectedStrand !== 'ALL' && c.strand !== selectedStrand) return false;
    if (selectedGrade !== 'ALL' && c.grade !== selectedGrade) return false;
    return true;
  });

  const getConceptIcon = (topicId: string) => {
    if (topicId.includes('AI')) return <BrainCircuit className="w-5 h-5 text-purple-600" />;
    if (topicId.includes('DATABASE') || topicId.includes('SQL'))
      return <Database className="w-5 h-5 text-blue-600" />;
    if (topicId.includes('WEB')) return <Globe className="w-5 h-5 text-emerald-600" />;
    if (topicId.includes('NET') || topicId.includes('HARDWARE') || topicId.includes('OPERATING'))
      return <Network className="w-5 h-5 text-amber-600" />;
    if (topicId.includes('PYTHON')) return <Code2 className="w-5 h-5 text-indigo-600" />;
    return <ShieldCheck className="w-5 h-5 text-slate-600" />;
  };

  return (
    <div className="space-y-8 w-full pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
              Khung GDPT 2018 - Tin học Ứng dụng & Cốt lõi (Bộ sách Kết nối tri thức)
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Bản Đồ Tri Thức & Đo Lường Năng Lực
          </h1>
          {/* Pedagogical modeling: Knowledge Graph mastery tracking & spaced repetition intervals */}
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mt-1 leading-relaxed">
            Mô hình hóa toàn bộ kiến thức Tin học THPT theo chủ đề. Mức độ thành thạo và gợi ý ôn tập được cập nhật tự động sau mỗi bài luyện tập.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Strand Filter */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setSelectedStrand('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedStrand === 'ALL'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setSelectedStrand('CS')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedStrand === 'CS'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Khoa học máy tính (CS)
            </button>
            <button
              onClick={() => setSelectedStrand('ICT')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedStrand === 'ICT'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ICT
            </button>
            <button
              onClick={() => setSelectedStrand('DL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedStrand === 'DL'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              DL
            </button>
          </div>

          {/* Grade Filter */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setSelectedGrade('ALL')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedGrade === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Khối 10-12
            </button>
            <button
              onClick={() => setSelectedGrade(12)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedGrade === 12
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lớp 12
            </button>
            <button
              onClick={() => setSelectedGrade(11)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedGrade === 11
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lớp 11
            </button>
            <button
              onClick={() => setSelectedGrade(10)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedGrade === 10
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lớp 10
            </button>
          </div>
        </div>
      </div>

      {/* Concept Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredConcepts.map((concept) => {
          const m = getVerifiedMastery(masteries, concept.id);
          const masteryScore = m ? Math.round(m.masteryScore * 100) : null;
          const confidence = m ? Math.round(m.confidenceScore * 100) : null;

          return (
            <div
              key={concept.id}
              className="card-compact-row flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                {/* Concept Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">
                      Lớp {concept.grade} • {STRAND_LABELS[concept.strand].code}
                    </span>
                    <h3 className="font-semibold text-slate-900 text-sm leading-snug mt-0.5">
                      {concept.name}
                    </h3>
                  </div>

                  <span
                    className={
                      masteryScore === null
                        ? 'status-caution'
                        : masteryScore >= 70
                        ? 'status-stable'
                        : masteryScore >= 50
                        ? 'status-caution'
                        : 'status-gap'
                    }
                  >
                    {masteryScore === null ? 'Chưa có dữ liệu' : `${masteryScore}%`}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    {masteryScore === null ? (
                      <span>Chưa có dữ liệu học tập gắn với tài khoản này</span>
                    ) : (
                      <>
                        <span>Làm chủ: {masteryScore}%</span>
                        <span>Độ tin cậy: {confidence}%</span>
                      </>
                    )}
                  </div>
                  {masteryScore !== null && (
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          masteryScore >= 70
                            ? 'bg-slate-800'
                            : masteryScore >= 50
                            ? 'bg-slate-500'
                            : 'bg-slate-300'
                        }`}
                        style={{ width: `${masteryScore}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {concept.description}
                </p>

                {/* Subconcepts Tags */}
                <div className="flex flex-wrap gap-1">
                  {concept.subconcepts.slice(0, 3).map((sub, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]"
                    >
                      {sub}
                    </span>
                  ))}
                  {concept.subconcepts.length > 3 && (
                    <span className="text-[10px] text-slate-400 self-center">
                      +{concept.subconcepts.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => onStartPracticeConcept(concept.id)}
                  className="btn-secondary text-xs py-1.5 px-3 flex-1 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>Luyện tập</span>
                </button>

                <button
                  onClick={() => onOpenVideoModal(concept.id)}
                  className="btn-ghost text-xs p-1.5 cursor-pointer"
                  title="Tạo bài giảng AI cho khái niệm này"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
