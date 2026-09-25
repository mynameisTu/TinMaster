import React, { useState } from 'react';
import {
  Question,
  DifficultyLevel,
  CognitiveLevel,
  SingleChoiceOption,
  TrueFalseStatement,
} from '../types';
import {
  PlusCircle,
  X,
  Code2,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';

interface ManualQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveQuestion: (question: Question) => void;
}

const TOPIC_OPTIONS = [
  { id: 'AI_FUNDAMENTALS', label: 'Trí tuệ nhân tạo (AI) & Học máy' },
  { id: 'WEB_DEVELOPMENT', label: 'Thiết kế Web & HTML5/CSS3' },
  { id: 'RELATIONAL_DATABASE', label: 'Cơ sở dữ liệu quan hệ (RDBMS)' },
  { id: 'SQL_QUERIES', label: 'Truy vấn cơ sở dữ liệu SQL' },
  { id: 'PYTHON_PROGRAMMING', label: 'Lập trình Python & Cấu trúc dữ liệu' },
  { id: 'COMPUTER_NETWORK', label: 'Mạng máy tính & Giao thức mạng' },
  { id: 'CYBER_SECURITY', label: 'An toàn thông tin & Đạo đức số' },
];

export const ManualQuestionModal: React.FC<ManualQuestionModalProps> = ({
  isOpen,
  onClose,
  onSaveQuestion,
}) => {
  const [questionType, setQuestionType] = useState<'single_choice' | 'true_false_multistatement'>('single_choice');
  const [stem, setStem] = useState('');
  const [hasCode, setHasCode] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState<'python' | 'sql' | 'html' | 'css'>('python');
  const [codeContent, setCodeContent] = useState('');
  const [topicId, setTopicId] = useState('PYTHON_PROGRAMMING');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [cognitiveLevel, setCognitiveLevel] = useState<CognitiveLevel>('comprehension');
  const [explanation, setExplanation] = useState('');

  // 4 Single choice options
  const [singleOptions, setSingleOptions] = useState<SingleChoiceOption[]>([
    { label: 'A', text: '', isCorrect: true },
    { label: 'B', text: '', isCorrect: false },
    { label: 'C', text: '', isCorrect: false },
    { label: 'D', text: '', isCorrect: false },
  ]);

  // 4 True/False statements
  const [tfStatements, setTfStatements] = useState<TrueFalseStatement[]>([
    { subOrder: 'a', statementText: '', isCorrect: true, explanation: '' },
    { subOrder: 'b', statementText: '', isCorrect: false, explanation: '' },
    { subOrder: 'c', statementText: '', isCorrect: true, explanation: '' },
    { subOrder: 'd', statementText: '', isCorrect: false, explanation: '' },
  ]);

  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectRadioCorrect = (label: 'A' | 'B' | 'C' | 'D') => {
    setSingleOptions((prev) =>
      prev.map((opt) => ({
        ...opt,
        isCorrect: opt.label === label,
      }))
    );
  };

  const handleToggleTrueFalse = (subOrder: 'a' | 'b' | 'c' | 'd', isCorrect: boolean) => {
    setTfStatements((prev) =>
      prev.map((st) => (st.subOrder === subOrder ? { ...st, isCorrect } : st))
    );
  };

  const handleSave = () => {
    if (!stem.trim()) {
      setFormError('Vui lòng nhập nội dung câu hỏi.');
      return;
    }

    if (questionType === 'single_choice') {
      const emptyOption = singleOptions.find((o) => !o.text.trim());
      if (emptyOption) {
        setFormError(`Vui lòng nhập nội dung cho phương án ${emptyOption.label}.`);
        return;
      }
    } else {
      const emptyStatement = tfStatements.find((s) => !s.statementText.trim());
      if (emptyStatement) {
        setFormError(`Vui lòng nhập nội dung cho phát biểu (${emptyStatement.subOrder}).`);
        return;
      }
    }

    setFormError(null);

    const newQuestion: Question = {
      id: `Q_MANUAL_${Date.now()}`,
      questionType,
      stem: stem.trim(),
      codeSnippet: hasCode && codeContent.trim() ? { language: codeLanguage, code: codeContent } : undefined,
      conceptId: topicId === 'AI_FUNDAMENTALS' ? 'CS12_AI_CONCEPTS' : 'CS12_WEB_HTML',
      topicId,
      grade: 12,
      strand: 'CS',
      cognitiveLevel,
      difficulty,
      estimatedTimeSec: 45,
      competencyCode: 'NLa',
      singleChoiceOptions: questionType === 'single_choice' ? singleOptions : undefined,
      trueFalseStatements: questionType === 'true_false_multistatement' ? tfStatements : undefined,
      explanation: explanation.trim() || 'Lời giải chi tiết chuẩn chương trình Tin học GDPT 2018.',
      keyTakeaway: 'Nội dung ôn luyện Tin học THPT.',
      source: 'Tạo thủ công bởi Giáo viên',
      sourceYear: 2025,
      isVerified: true,
    };

    onSaveQuestion(newQuestion);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Tạo Bài Tập Thủ Công
              </h2>
              <p className="text-xs text-slate-500">
                Soạn thảo câu hỏi trắc nghiệm hoặc đúng/sai vào ngân hàng bài tập.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Question Type Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Dạng câu hỏi:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setQuestionType('single_choice')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                  questionType === 'single_choice'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold ring-1 ring-blue-600'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs">Phần I: Trắc nghiệm 4 lựa chọn</div>
                <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                  1 đáp án đúng duy nhất (A, B, C hoặc D)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setQuestionType('true_false_multistatement')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                  questionType === 'true_false_multistatement'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold ring-1 ring-blue-600'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs">Phần II: Đúng / Sai (4 ý)</div>
                <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                  Gồm 4 phát biểu a, b, c, d đánh giá độc lập
                </div>
              </button>
            </div>
          </div>

          {/* Stem Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Nội dung câu hỏi (Đề bài): <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={stem}
              onChange={(e) => setStem(e.target.value)}
              placeholder="Nhập đề bài câu hỏi..."
              className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Code Snippet Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <Code2 className="w-4 h-4 text-purple-600" />
                <span>Mã chương trình (Tùy chọn)</span>
              </label>
              <button
                type="button"
                onClick={() => setHasCode(!hasCode)}
                className="text-xs font-medium text-blue-600 hover:underline cursor-pointer"
              >
                {hasCode ? 'Gỡ đoạn mã code' : '+ Thêm đoạn mã code'}
              </button>
            </div>

            {hasCode && (
              <div className="p-3 bg-slate-900 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Ngôn ngữ lập trình:</span>
                  <select
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value as any)}
                    className="text-xs bg-slate-800 text-white rounded px-2 py-1 border border-slate-700 cursor-pointer"
                  >
                    <option value="python">Python</option>
                    <option value="sql">SQL</option>
                    <option value="html">HTML5</option>
                    <option value="css">CSS3</option>
                  </select>
                </div>
                <textarea
                  rows={3}
                  value={codeContent}
                  onChange={(e) => setCodeContent(e.target.value)}
                  placeholder="Nhập đoạn mã code tại đây..."
                  className="w-full bg-slate-800 text-purple-200 font-mono text-xs p-2.5 rounded-lg border border-slate-700 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Options Section */}
          {questionType === 'single_choice' && (
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-700">
                Các phương án lựa chọn (Chọn tròn phương án Đúng): <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {singleOptions.map((opt) => (
                  <div
                    key={opt.label}
                    className={`p-2.5 rounded-xl border flex items-center space-x-2.5 transition ${
                      opt.isCorrect
                        ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-400'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="manual_correct_opt"
                      checked={opt.isCorrect}
                      onChange={() => handleSelectRadioCorrect(opt.label)}
                      className="w-4 h-4 text-emerald-600 accent-emerald-600 cursor-pointer"
                    />
                    <span className="font-mono font-bold text-xs text-slate-700 w-5">
                      {opt.label}.
                    </span>
                    <input
                      type="text"
                      placeholder={`Nội dung phương án ${opt.label}...`}
                      value={opt.text}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSingleOptions((prev) =>
                          prev.map((o) => (o.label === opt.label ? { ...o, text: val } : o))
                        );
                      }}
                      className="flex-1 text-xs px-2 py-1 rounded bg-transparent focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {questionType === 'true_false_multistatement' && (
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-700">
                4 Phát biểu Đúng / Sai (Phần II): <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {tfStatements.map((st) => (
                  <div
                    key={st.subOrder}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="font-mono font-bold text-xs text-slate-700 w-5">
                        {st.subOrder})
                      </span>
                      <input
                        type="text"
                        placeholder={`Nội dung phát biểu ${st.subOrder}...`}
                        value={st.statementText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTfStatements((prev) =>
                            prev.map((s) =>
                              s.subOrder === st.subOrder ? { ...s, statementText: val } : s
                            )
                          );
                        }}
                        className="flex-1 text-xs px-2 py-1 rounded border border-slate-200 focus:border-blue-500"
                      />
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleTrueFalse(st.subOrder, true)}
                        className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition ${
                          st.isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Đúng
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleTrueFalse(st.subOrder, false)}
                        className={`px-3 py-1 text-xs font-bold rounded cursor-pointer transition ${
                          !st.isCorrect
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Sai
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Chủ đề:</label>
              <select
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white cursor-pointer"
              >
                {TOPIC_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Độ khó:</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white cursor-pointer"
              >
                <option value="easy">Dễ (Cơ bản)</option>
                <option value="medium">Vừa (Thông hiểu)</option>
                <option value="hard">Khó (Vận dụng 8+)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Cấp độ tư duy:</label>
              <select
                value={cognitiveLevel}
                onChange={(e) => setCognitiveLevel(e.target.value as CognitiveLevel)}
                className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white cursor-pointer"
              >
                <option value="knowledge">Nhận biết</option>
                <option value="comprehension">Thông hiểu</option>
                <option value="application">Vận dụng</option>
                <option value="high_application">Vận dụng cao</option>
              </select>
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Lời giải chi tiết:</label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Nhập hướng dẫn giải, kiến thức trọng tâm hoặc lý do đáp án đúng..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            Lưu bài tập
          </button>
        </div>
      </div>
    </div>
  );
};
