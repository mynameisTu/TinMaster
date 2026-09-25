import React, { useState, useEffect } from 'react';
import { VideoLessonScript, VideoStoryboardScene } from '../types';
import { CONCEPTS_LIST } from '../data/curriculumData';
import { AIPedagogicalService } from '../services/aiService';
import {
  Sparkles,
  X,
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  Volume2,
  Code2,
  CheckCircle2,
  Film,
  RotateCcw,
} from 'lucide-react';

interface AIVideoLessonModalProps {
  initialConceptId?: string;
  onClose: () => void;
}

export const AIVideoLessonModal: React.FC<AIVideoLessonModalProps> = ({
  initialConceptId,
  onClose,
}) => {
  const [selectedConceptId, setSelectedConceptId] = useState<string>(
    initialConceptId || CONCEPTS_LIST[0].id
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [script, setScript] = useState<VideoLessonScript | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);

  const selectedConcept = CONCEPTS_LIST.find((c) => c.id === selectedConceptId);

  const handleGenerateScript = async (conceptId: string) => {
    setIsLoading(true);
    setCurrentSceneIndex(0);
    setIsPlaying(false);
    setSelectedQuizOption(null);

    const c = CONCEPTS_LIST.find((item) => item.id === conceptId);
    const data = await AIPedagogicalService.generateVideoLessonScript(
      conceptId,
      c?.name || 'Khái niệm Tin học',
      c?.topicName || 'Chuyên đề'
    );

    setScript(data);
    setIsLoading(false);
  };

  useEffect(() => {
    handleGenerateScript(selectedConceptId);
  }, []);

  const currentScene: VideoStoryboardScene | undefined = script?.scenes[currentSceneIndex];

  // Speech synthesis for voiceover
  const handleSpeakNarration = () => {
    if (!currentScene || !('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(currentScene.narrationVoiceover);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Stop speech when changing scenes or unmounting
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [currentSceneIndex, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-10">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Film className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
                Xưởng Bài Giảng Video Cá Nhân Hóa
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Biên Soạn Kịch Bản Video Vi Mô 3 Phút
            </h2>
          </div>

          {/* Concept selector */}
          <select
            value={selectedConceptId}
            onChange={(e) => {
              setSelectedConceptId(e.target.value);
              handleGenerateScript(e.target.value);
            }}
            className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
          >
            {CONCEPTS_LIST.map((c) => (
              <option key={c.id} value={c.id}>
                Khối {c.grade} • {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-800">
              Đang phân tích SGK Kết nối tri thức và biên soạn kịch bản sư phạm...
            </p>
            <p className="text-xs text-slate-400">
              Trí tuệ nhân tạo đang tạo kịch bản phân cảnh (Storyboard) và bộ câu hỏi mini-quiz
            </p>
          </div>
        )}

        {/* Script Content */}
        {!isLoading && script && currentScene && (
          <div className="space-y-6">
            {/* Objective Banner */}
            <div className="bg-purple-50/70 border border-purple-200 p-3.5 rounded-2xl flex items-start space-x-3 text-xs text-purple-950">
              <Sparkles className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-purple-900">Mục tiêu bài học: </strong>
                {script.learningObjective}
              </div>
            </div>

            {/* Scene Stepper Bar */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              {script.scenes.map((scene, idx) => {
                const isActive = idx === currentSceneIndex;
                return (
                  <button
                    key={scene.sceneNumber}
                    onClick={() => setCurrentSceneIndex(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Phân cảnh {idx + 1} ({scene.durationSeconds}s)
                  </button>
                );
              })}
            </div>

            {/* Main Stage Viewport (Simulated Video Screen) */}
            <div className="bg-slate-950 rounded-2xl p-6 text-white space-y-4 shadow-xl border border-slate-800 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-800">
                <span className="font-bold uppercase tracking-wider text-purple-400">
                  {currentScene.title}
                </span>
                <span className="font-sans"><span className="font-mono">{currentScene.durationSeconds}</span> giây</span>
              </div>

              {/* Visual Presentation Area */}
              <div className="min-h-[160px] flex flex-col justify-center space-y-3">
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Đồ họa hiển thị trên màn hình
                  </span>
                  <p className="italic text-slate-200">{currentScene.visualDescription}</p>
                </div>

                {/* Optional Code overlay */}
                {currentScene.codeSnippet && (
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto">
                    <pre>{currentScene.codeSnippet}</pre>
                  </div>
                )}

                {/* Key Takeaway Overlay */}
                <div className="bg-purple-950/60 border border-purple-500/30 p-3 rounded-xl text-xs text-purple-200 font-medium">
                  <strong>Khắc sâu: </strong> {currentScene.keyHighlight}
                </div>
              </div>

              {/* Voiceover Narration Bar */}
              <div className="pt-3 border-t border-slate-800 flex items-start justify-between gap-3">
                <div className="space-y-1 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Lời thoại thuyết minh (Voiceover)
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    "{currentScene.narrationVoiceover}"
                  </p>
                </div>

                <button
                  onClick={handleSpeakNarration}
                  className={`p-2.5 rounded-xl transition shrink-0 cursor-pointer ${
                    isSpeaking
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                  title="Nghe đọc thuyết minh tiếng Việt"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Stepper Navigation */}
            <div className="flex items-center justify-between">
              <button
                disabled={currentSceneIndex === 0}
                onClick={() => setCurrentSceneIndex((prev) => Math.max(0, prev - 1))}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center space-x-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Cảnh trước</span>
              </button>

              <span className="text-xs text-slate-400 font-medium">
                Cảnh {currentSceneIndex + 1} / {script.scenes.length}
              </span>

              <button
                disabled={currentSceneIndex === script.scenes.length - 1}
                onClick={() => setCurrentSceneIndex((prev) => Math.min(script.scenes.length - 1, prev + 1))}
                className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center space-x-1 cursor-pointer"
              >
                <span>Cảnh tiếp theo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Mini Quiz at bottom */}
            {script.miniQuiz && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Mini-Quiz Kiểm tra Hiệu quả Sau Video
                  </h4>
                </div>

                <p className="text-sm font-medium text-slate-800">
                  {script.miniQuiz.questionText}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {script.miniQuiz.options.map((opt, i) => {
                    const isSelected = selectedQuizOption === i;
                    const isCorrect = i === script.miniQuiz.correctIndex;

                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedQuizOption(i)}
                        className={`text-left p-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                          selectedQuizOption !== null
                            ? isCorrect
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                              : isSelected
                              ? 'bg-red-50 border-red-500 text-red-950'
                              : 'bg-white border-slate-200 text-slate-600'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {selectedQuizOption !== null && (
                  <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
                    <strong>Giải thích: </strong> {script.miniQuiz.explanation}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
