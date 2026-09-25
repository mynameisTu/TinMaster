import React, { useState, useRef, useMemo } from 'react';
import {
  Question,
  DifficultyLevel,
  CognitiveLevel,
  COGNITIVE_LEVEL_LABELS,
  SingleChoiceOption,
  TrueFalseStatement,
} from '../types';
import { CONCEPTS_LIST } from '../data/curriculumData';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  FileType,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  Plus,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Clock,
  Check,
  Code2,
} from 'lucide-react';

interface ExtractedQuestionDraft extends Question {
  confidence?: 'high' | 'medium' | 'low';
  needsReview?: boolean;
  reviewReason?: string;
  sourceFile?: string;
}

interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  typeCategory: 'docx' | 'pdf' | 'image';
  base64?: string;
  status: 'pending' | 'extracting' | 'completed' | 'error';
  extractedCount?: number;
  errorMessage?: string;
}

interface UploadExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmQuestions: (questions: Question[]) => void;
}

const SUPPORTED_EXTENSIONS = ['.docx', '.pdf', '.jpg', '.jpeg', '.png'];
const SUPPORTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'image/jpeg',
  'image/png',
];

const TOPIC_OPTIONS = [
  { id: 'AI_FUNDAMENTALS', label: 'Trí tuệ nhân tạo (AI) & Học máy' },
  { id: 'WEB_DEVELOPMENT', label: 'Thiết kế Web & HTML5/CSS3' },
  { id: 'RELATIONAL_DATABASE', label: 'Cơ sở dữ liệu quan hệ (RDBMS)' },
  { id: 'SQL_QUERIES', label: 'Truy vấn cơ sở dữ liệu SQL' },
  { id: 'PYTHON_PROGRAMMING', label: 'Lập trình Python & Cấu trúc dữ liệu' },
  { id: 'COMPUTER_NETWORK', label: 'Mạng máy tính & Giao thức mạng' },
  { id: 'CYBER_SECURITY', label: 'An toàn thông tin & Đạo đức số' },
];

export const UploadExerciseModal: React.FC<UploadExerciseModalProps> = ({
  isOpen,
  onClose,
  onConfirmQuestions,
}) => {
  // Step 1: Upload | Step 2: Processing | Step 3: Review & Confirm
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Files in batch
  const [filesList, setFilesList] = useState<FileItem[]>([]);
  const [answerKeyFile, setAnswerKeyFile] = useState<{
    file: File;
    name: string;
    size: number;
    base64?: string;
  } | null>(null);

  // Drag & drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Processing state
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0);

  // Review step state
  const [draftQuestions, setDraftQuestions] = useState<ExtractedQuestionDraft[]>([]);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'needs_review' | 'ready'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const answerKeyInputRef = useRef<HTMLInputElement>(null);

  // Filtered drafts for Review step
  const filteredDrafts = useMemo(() => {
    return draftQuestions.filter((q) => {
      if (reviewFilter === 'needs_review') return q.needsReview || q.confidence === 'low';
      if (reviewFilter === 'ready') return !q.needsReview && q.confidence !== 'low';
      return true;
    });
  }, [draftQuestions, reviewFilter]);

  const needsReviewCount = useMemo(() => {
    return draftQuestions.filter((q) => q.needsReview || q.confidence === 'low').length;
  }, [draftQuestions]);

  if (!isOpen) return null;

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Determine file category
  const getFileCategory = (name: string): 'docx' | 'pdf' | 'image' | null => {
    const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
    if (ext === '.docx') return 'docx';
    if (ext === '.pdf') return 'pdf';
    if (['.jpg', '.jpeg', '.png'].includes(ext)) return 'image';
    return null;
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Add files to batch with strict validation
  const handleAddFiles = (newFiles: FileList | File[]) => {
    setValidationError(null);
    const validItems: FileItem[] = [];
    let hasInvalid = false;

    Array.from(newFiles).forEach((f) => {
      const cat = getFileCategory(f.name);
      if (!cat) {
        hasInvalid = true;
        return;
      }

      validItems.push({
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file: f,
        name: f.name,
        size: f.size,
        typeCategory: cat,
        status: 'pending',
      });
    });

    if (hasInvalid) {
      setValidationError('Chỉ hỗ trợ file DOCX, PDF, JPEG, PNG. Một số file không đúng định dạng đã bị bỏ qua.');
    }

    if (validItems.length > 0) {
      setFilesList((prev) => [...prev, ...validItems]);
    }
  };

  // Handle Answer key selection
  const handleSelectAnswerKey = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const cat = getFileCategory(f.name);
    if (!cat) {
      setValidationError('File đáp án chỉ hỗ trợ định dạng DOCX, PDF, JPEG, PNG.');
      return;
    }
    setValidationError(null);
    setAnswerKeyFile({
      file: f,
      name: f.name,
      size: f.size,
    });
  };

  // Remove file from batch
  const handleRemoveFile = (id: string) => {
    setFilesList((prev) => prev.filter((item) => item.id !== id));
  };

  // Start processing pipeline
  const handleStartExtraction = async () => {
    if (filesList.length === 0) return;

    setCurrentStep(2);
    setCurrentProcessingIndex(0);
    const accumulatedDrafts: ExtractedQuestionDraft[] = [];

    // Read answer key base64 if present
    let answerKeyPayload: any = undefined;
    if (answerKeyFile) {
      try {
        const keyB64 = await fileToBase64(answerKeyFile.file);
        answerKeyPayload = {
          name: answerKeyFile.name,
          type: getFileCategory(answerKeyFile.name),
          mimeType: answerKeyFile.file.type,
          base64: keyB64,
        };
      } catch (err) {
        console.warn('Could not read answer key file:', err);
      }
    }

    // Process each file in the batch sequentially
    for (let i = 0; i < filesList.length; i++) {
      setCurrentProcessingIndex(i);
      const current = filesList[i];

      // Update current file status to extracting
      setFilesList((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'extracting' } : item))
      );

      try {
        const base64Data = await fileToBase64(current.file);

        const response = await fetch('/api/exercises/extract-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: {
              name: current.name,
              type: current.typeCategory,
              mimeType: current.file.type,
              base64: base64Data,
            },
            answerKeyFile: answerKeyPayload,
          }),
        });

        const data = await response.json();

        if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
          const uniqueBatchQuestions = data.questions.map((q: any, qIdx: number) => ({
            ...q,
            id: q.id
              ? `${q.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${qIdx + 1}`
              : `Q_IMP_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${qIdx + 1}`,
          }));
          accumulatedDrafts.push(...uniqueBatchQuestions);
          setFilesList((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? {
                    ...item,
                    status: 'completed',
                    extractedCount: data.questions.length,
                  }
                : item
            )
          );
        } else {
          // Graceful error per file without breaking the rest
          setFilesList((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? {
                    ...item,
                    status: 'error',
                    errorMessage:
                      data.error ||
                      'Không thể đọc file này, vui lòng thử lại hoặc nhập thủ công.',
                  }
                : item
            )
          );
        }
      } catch (err: any) {
        setFilesList((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: 'error',
                  errorMessage:
                    'Không thể đọc file này, vui lòng thử lại hoặc nhập thủ công.',
                }
              : item
          )
        );
      }
    }

    // Transition to Review step with extracted questions
    setDraftQuestions(accumulatedDrafts);
    setCurrentStep(3);
  };

  // Modify draft question field in Review screen
  const handleUpdateDraft = (index: number, updates: Partial<ExtractedQuestionDraft>) => {
    setDraftQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  // Toggle single choice option correct answer
  const handleSelectCorrectOption = (qIndex: number, optLabel: 'A' | 'B' | 'C' | 'D') => {
    setDraftQuestions((prev) => {
      const copy = [...prev];
      const q = { ...copy[qIndex] };
      if (q.singleChoiceOptions) {
        q.singleChoiceOptions = q.singleChoiceOptions.map((opt) => ({
          ...opt,
          isCorrect: opt.label === optLabel,
        }));
        // Since teacher manually picked correct answer, mark as reviewed
        q.needsReview = false;
        q.confidence = 'high';
        q.reviewReason = '';
      }
      copy[qIndex] = q;
      return copy;
    });
  };

  // Toggle true/false statement correctness
  const handleToggleTrueFalse = (qIndex: number, subOrder: 'a' | 'b' | 'c' | 'd', isCorrect: boolean) => {
    setDraftQuestions((prev) => {
      const copy = [...prev];
      const q = { ...copy[qIndex] };
      if (q.trueFalseStatements) {
        q.trueFalseStatements = q.trueFalseStatements.map((st) =>
          st.subOrder === subOrder ? { ...st, isCorrect } : st
        );
      }
      copy[qIndex] = q;
      return copy;
    });
  };

  // Remove question in review
  const handleDeleteDraft = (index: number) => {
    setDraftQuestions((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Final confirmation to save into question bank
  const handleConfirmAndSave = () => {
    if (draftQuestions.length === 0) {
      onClose();
      return;
    }

    // Clean review meta fields and ensure proper structure with strictly unique IDs
    const seenIds = new Set<string>();
    const cleanedQuestions: Question[] = draftQuestions.map((draft, idx) => {
      const { confidence, needsReview, reviewReason, sourceFile, ...cleanQ } = draft;
      let finalId = cleanQ.id;
      if (!finalId || seenIds.has(finalId)) {
        finalId = `Q_IMP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx + 1}`;
      }
      seenIds.add(finalId);
      return {
        ...cleanQ,
        id: finalId,
        isVerified: true,
      };
    });

    onConfirmQuestions(cleanedQuestions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Tải Lên Đề Bài & Số Hóa Tự Động (AI)
                </h2>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[11px] font-bold">
                  Giáo viên & Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hỗ trợ trích xuất đề thi từ file DOCX, PDF, hoặc hình ảnh JPG/PNG kèm bảng đáp án.
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: UPLOAD & CONFIGURE */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Validation error notification */}
              {validationError && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{validationError}</div>
                  <button
                    onClick={() => setValidationError(null)}
                    className="text-amber-500 hover:text-amber-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Drag & Drop Main Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files) {
                    handleAddFiles(e.dataTransfer.files);
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".docx,.pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleAddFiles(e.target.files);
                    e.target.value = '';
                  }}
                />

                <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5">
                  <Upload className="w-7 h-7" />
                </div>

                <h3 className="text-sm sm:text-base font-bold text-slate-800">
                  Kéo và thả file đề bài vào đây, hoặc click để chọn file
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Bạn có thể chọn cùng lúc nhiều file (VD: tải lên 5 ảnh chụp từng trang đề bài).
                </p>

                <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200">
                    .DOCX (Word)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 text-[11px] font-semibold border border-red-200">
                    .PDF (Số hóa / Scan)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[11px] font-semibold border border-purple-200">
                    .JPG / .PNG (Ảnh chụp OCR)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Chọn file từ máy tính
                </button>
              </div>

              {/* Selected Files List in Batch */}
              {filesList.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Danh sách file tải lên ({filesList.length})
                    </span>
                    <button
                      onClick={() => setFilesList([])}
                      className="text-xs text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      Xóa tất cả
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                    {filesList.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between hover:border-slate-300 transition"
                      >
                        <div className="flex items-center space-x-2.5 overflow-hidden">
                          {item.typeCategory === 'docx' && (
                            <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                          )}
                          {item.typeCategory === 'pdf' && (
                            <FileType className="w-5 h-5 text-red-600 shrink-0" />
                          )}
                          {item.typeCategory === 'image' && (
                            <ImageIcon className="w-5 h-5 text-purple-600 shrink-0" />
                          )}
                          <div className="truncate">
                            <p className="text-xs font-semibold text-slate-800 truncate" title={item.name}>
                              {item.name}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {formatSize(item.size)} • {item.typeCategory.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFile(item.id)}
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition cursor-pointer shrink-0 ml-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional Answer Key Section */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800">
                        File Bảng Đáp Án (Tùy chọn)
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Tự động ghép đáp án
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Nếu đề thi và đáp án nằm ở 2 file riêng biệt, tải file đáp án tại đây để AI tự đối chiếu số thứ tự câu.
                    </p>
                  </div>

                  {!answerKeyFile && (
                    <button
                      type="button"
                      onClick={() => answerKeyInputRef.current?.click()}
                      className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition cursor-pointer"
                    >
                      + Đính kèm đáp án
                    </button>
                  )}
                </div>

                <input
                  ref={answerKeyInputRef}
                  type="file"
                  accept=".docx,.pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    handleSelectAnswerKey(e.target.files);
                    e.target.value = '';
                  }}
                />

                {answerKeyFile && (
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2 truncate">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs font-medium text-slate-800 truncate" title={answerKeyFile.name}>
                        {answerKeyFile.name} ({formatSize(answerKeyFile.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAnswerKeyFile(null)}
                      className="text-xs text-red-500 hover:text-red-700 cursor-pointer ml-2"
                    >
                      Gỡ bỏ
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: PROCESSING STATE */}
          {currentStep === 2 && (
            <div className="py-8 space-y-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center animate-pulse">
                <Sparkles className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Đang trích xuất nội dung từ file... ({currentProcessingIndex + 1}/{filesList.length} file hoàn tất)
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Hệ thống đang chạy bộ OCR và mô hình AI để nhận diện công thức, mã code và cấu trúc hóa đề bài.
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-md mx-auto bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round(((currentProcessingIndex + 1) / filesList.length) * 100)}%`,
                  }}
                />
              </div>

              {/* Per-file live status list */}
              <div className="max-w-lg mx-auto space-y-2 text-left pt-2">
                {filesList.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                      idx === currentProcessingIndex
                        ? 'border-blue-400 bg-blue-50/50 font-semibold'
                        : item.status === 'completed'
                        ? 'border-emerald-200 bg-emerald-50/40 text-slate-700'
                        : item.status === 'error'
                        ? 'border-red-200 bg-red-50/40 text-slate-700'
                        : 'border-slate-200 bg-slate-50/40 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {item.status === 'extracting' && (
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                      )}
                      {item.status === 'completed' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      {item.status === 'error' && (
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                      {item.status === 'pending' && (
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{item.name}</span>
                    </div>

                    <div className="text-[11px] shrink-0 ml-2">
                      {item.status === 'extracting' && (
                        <span className="text-blue-600 font-medium">Đang xử lý OCR & AI...</span>
                      )}
                      {item.status === 'completed' && (
                        <span className="text-emerald-700 font-bold">
                          Đã trích xuất {item.extractedCount || 0} câu
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="text-red-600">{item.errorMessage || 'Lỗi đọc file'}</span>
                      )}
                      {item.status === 'pending' && <span className="text-slate-400">Đang chờ...</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & CONFIRM STEP (CRITICAL — do not auto-publish) */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Review Banner */}
              <div className="p-4 bg-blue-50/80 rounded-xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-blue-900">
                      Rà soát & Chỉnh sửa trước khi lưu ({draftQuestions.length} câu hỏi)
                    </h3>
                  </div>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Hệ thống KHÔNG tự động lưu vào ngân hàng. Vui lòng kiểm tra kỹ nội dung, phương án và đáp án trước khi bấm xác nhận.
                  </p>
                </div>

                {needsReviewCount > 0 && (
                  <div className="px-3 py-1.5 bg-amber-100/90 text-amber-800 text-xs font-bold rounded-lg border border-amber-300 flex items-center space-x-1.5 self-start sm:self-auto shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{needsReviewCount} câu cần kiểm tra</span>
                  </div>
                )}
              </div>

              {/* Filters & Tabs */}
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-200 pb-3">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setReviewFilter('all')}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                      reviewFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({draftQuestions.length})
                  </button>

                  {needsReviewCount > 0 && (
                    <button
                      onClick={() => setReviewFilter('needs_review')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                        reviewFilter === 'needs_review'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Cần kiểm tra ({needsReviewCount})</span>
                    </button>
                  )}

                  <button
                    onClick={() => setReviewFilter('ready')}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                      reviewFilter === 'ready'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Đã sẵn sàng ({draftQuestions.length - needsReviewCount})
                  </button>
                </div>

                <div className="text-xs text-slate-500">
                  Hiển thị <strong>{filteredDrafts.length}</strong> / {draftQuestions.length} câu hỏi
                </div>
              </div>

              {/* Question list for editing */}
              <div className="space-y-4">
                {filteredDrafts.length > 0 ? (
                  filteredDrafts.map((q, qIndex) => {
                    const originalIndex = draftQuestions.findIndex((item) => item.id === q.id);
                    const isNeedsReview = q.needsReview || q.confidence === 'low';

                    return (
                      <div
                        key={q.id ? `${q.id}-${qIndex}` : `draft-${qIndex}`}
                        className={`p-5 rounded-xl border transition space-y-4 ${
                          isNeedsReview
                            ? 'border-amber-300 bg-amber-50/20 shadow-xs'
                            : 'border-slate-200 bg-white shadow-xs'
                        }`}
                      >
                        {/* Header of Question Card */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 text-xs px-2 py-0.5 bg-slate-100 rounded">
                              Câu {originalIndex + 1}
                            </span>

                            {q.sourceFile && (
                              <span className="text-[11px] text-slate-500 truncate max-w-xs" title={q.sourceFile}>
                                Nguồn: {q.sourceFile}
                              </span>
                            )}

                            {isNeedsReview ? (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-bold flex items-center space-x-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>{q.reviewReason || 'Độ tin cậy OCR thấp / Cần rà soát'}</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center space-x-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Độ tin cậy cao</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            {/* Question Type Switch */}
                            <select
                              value={q.questionType}
                              onChange={(e) =>
                                handleUpdateDraft(originalIndex, {
                                  questionType: e.target.value as any,
                                })
                              }
                              className="text-xs py-1 px-2 rounded-lg border border-slate-200 bg-white font-medium cursor-pointer"
                            >
                              <option value="single_choice">Phần I (4 Lựa chọn A,B,C,D)</option>
                              <option value="true_false_multistatement">Phần II (Đúng / Sai 4 ý)</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleDeleteDraft(originalIndex)}
                              className="text-xs text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition cursor-pointer"
                              title="Xóa câu hỏi này khỏi danh sách import"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Question Stem (Editable) */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span>Nội dung câu hỏi (Đề bài):</span>
                            <span className="text-[10px] text-slate-400 font-normal">Có thể chỉnh sửa trực tiếp</span>
                          </label>
                          <textarea
                            rows={3}
                            value={q.stem}
                            onChange={(e) =>
                              handleUpdateDraft(originalIndex, { stem: e.target.value })
                            }
                            className="w-full text-xs sm:text-sm p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed"
                            placeholder="Nhập nội dung đề bài..."
                          />
                        </div>

                        {/* Optional Code Snippet */}
                        {q.codeSnippet && (
                          <div className="space-y-1.5 p-3 bg-slate-900 rounded-lg text-white">
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span className="font-mono flex items-center space-x-1">
                                <Code2 className="w-3.5 h-3.5" />
                                <span>Mã chương trình ({q.codeSnippet.language})</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateDraft(originalIndex, { codeSnippet: undefined })}
                                className="text-slate-400 hover:text-red-400 text-[10px] cursor-pointer"
                              >
                                Gỡ đoạn code
                              </button>
                            </div>
                            <textarea
                              rows={2}
                              value={q.codeSnippet.code}
                              onChange={(e) =>
                                handleUpdateDraft(originalIndex, {
                                  codeSnippet: {
                                    ...q.codeSnippet!,
                                    code: e.target.value,
                                  },
                                })
                              }
                              className="w-full bg-slate-800 text-purple-200 font-mono text-xs p-2 rounded border border-slate-700 focus:outline-hidden"
                            />
                          </div>
                        )}

                        {/* Options Section: Single Choice vs True/False */}
                        {q.questionType === 'single_choice' && (
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                              <span>Các phương án lựa chọn (Chọn tròn phương án Đúng):</span>
                              {isNeedsReview && !q.singleChoiceOptions?.some((o) => o.isCorrect) && (
                                <span className="text-amber-600 text-xs font-bold flex items-center space-x-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Chưa chọn đáp án đúng!</span>
                                </span>
                              )}
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {(q.singleChoiceOptions || []).map((opt) => (
                                <div
                                  key={opt.label}
                                  className={`p-2.5 rounded-lg border flex items-center space-x-2 transition ${
                                    opt.isCorrect
                                      ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-400'
                                      : 'border-slate-200 bg-white'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`correct_${q.id}`}
                                    checked={!!opt.isCorrect}
                                    onChange={() => handleSelectCorrectOption(originalIndex, opt.label)}
                                    className="w-4 h-4 text-emerald-600 cursor-pointer accent-emerald-600"
                                    title={`Đánh dấu ${opt.label} là đáp án đúng`}
                                  />
                                  <span className="font-mono font-bold text-xs text-slate-700 w-4">
                                    {opt.label}.
                                  </span>
                                  <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) => {
                                      const nextOpts = (q.singleChoiceOptions || []).map((o) =>
                                        o.label === opt.label ? { ...o, text: e.target.value } : o
                                      );
                                      handleUpdateDraft(originalIndex, { singleChoiceOptions: nextOpts });
                                    }}
                                    className="flex-1 text-xs px-2 py-1 rounded border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white bg-transparent"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {q.questionType === 'true_false_multistatement' && (
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700">
                              4 Ý Đúng / Sai (Phần II):
                            </label>
                            <div className="space-y-2">
                              {(q.trueFalseStatements || []).map((st) => (
                                <div
                                  key={st.subOrder}
                                  className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-3"
                                >
                                  <div className="flex items-center space-x-2 flex-1">
                                    <span className="font-mono font-bold text-xs text-slate-700 w-4">
                                      {st.subOrder})
                                    </span>
                                    <input
                                      type="text"
                                      value={st.statementText}
                                      onChange={(e) => {
                                        const nextSt = (q.trueFalseStatements || []).map((item) =>
                                          item.subOrder === st.subOrder
                                            ? { ...item, statementText: e.target.value }
                                            : item
                                        );
                                        handleUpdateDraft(originalIndex, { trueFalseStatements: nextSt });
                                      }}
                                      className="flex-1 text-xs px-2 py-1 rounded border border-slate-200 focus:border-blue-500"
                                    />
                                  </div>

                                  <div className="flex items-center space-x-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleTrueFalse(originalIndex, st.subOrder, true)}
                                      className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition ${
                                        st.isCorrect
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                      }`}
                                    >
                                      Đúng
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleTrueFalse(originalIndex, st.subOrder, false)}
                                      className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition ${
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

                        {/* Metadata Tagging (Topic & Difficulty & Cognitive) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                              Chủ đề đề xuất:
                            </label>
                            <select
                              value={q.topicId}
                              onChange={(e) =>
                                handleUpdateDraft(originalIndex, { topicId: e.target.value })
                              }
                              className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white font-medium cursor-pointer"
                            >
                              {TOPIC_OPTIONS.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                              Độ khó:
                            </label>
                            <select
                              value={q.difficulty}
                              onChange={(e) =>
                                handleUpdateDraft(originalIndex, {
                                  difficulty: e.target.value as DifficultyLevel,
                                })
                              }
                              className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white font-medium cursor-pointer"
                            >
                              <option value="easy">Dễ (Cơ bản)</option>
                              <option value="medium">Vừa (Thông hiểu / Vận dụng)</option>
                              <option value="hard">Khó (Vận dụng cao 8+)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                              Cấp độ tư duy:
                            </label>
                            <select
                              value={q.cognitiveLevel}
                              onChange={(e) =>
                                handleUpdateDraft(originalIndex, {
                                  cognitiveLevel: e.target.value as CognitiveLevel,
                                })
                              }
                              className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white font-medium cursor-pointer"
                            >
                              <option value="knowledge">Nhận biết</option>
                              <option value="comprehension">Thông hiểu</option>
                              <option value="application">Vận dụng</option>
                              <option value="high_application">Vận dụng cao</option>
                            </select>
                          </div>
                        </div>

                        {/* Explanation (Editable) */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600 block">
                            Lời giải chi tiết:
                          </label>
                          <textarea
                            rows={2}
                            value={q.explanation}
                            onChange={(e) =>
                              handleUpdateDraft(originalIndex, { explanation: e.target.value })
                            }
                            className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-blue-500 font-sans"
                            placeholder="Nhập lời giải thích chi tiết cho học sinh..."
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500">
                    <p className="text-sm font-semibold">Không có câu hỏi nào trong bộ lọc này.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div>
            {currentStep === 3 && (
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                ← Tải file khác
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Hủy bỏ
            </button>

            {currentStep === 1 && (
              <button
                type="button"
                disabled={filesList.length === 0}
                onClick={handleStartExtraction}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Bắt đầu trích xuất AI ({filesList.length} file)</span>
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                disabled={draftQuestions.length === 0}
                onClick={handleConfirmAndSave}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Xác nhận & Lưu ({draftQuestions.length} câu)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
