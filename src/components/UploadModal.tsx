import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Film, 
  Sparkles, 
  Check, 
  Loader2, 
  AlertCircle, 
  HardDrive, 
  Youtube, 
  Link as LinkIcon,
  Trash2,
  CheckCircle2,
  Play,
  Layers,
  Plus,
  FileText,
  CheckCheck,
  Flame,
  Coins
} from 'lucide-react';
import { CategoryType, PhotoItem, VideoItem, UserProfile, PrivateGalleryName, PrivateVideoItem } from '../types';
import { PRIVATE_GALLERIES } from '../data/initialData';
import { soundFX } from '../utils/audio';
import { compressImageFile } from '../utils/imageCompressor';
import { extractVideoMeta, parseYouTubeUrl, saveLocalVideoBlob } from '../utils/videoStorage';
import { generateInitialLikes } from '../utils/formatters';
import { uploadMediaToServer, MAX_INLINE_VIDEO_BYTES, blobToDataUrl } from '../utils/mediaUploader';
import { uploadVideoToFirestoreChunks } from '../utils/cloudMediaStore';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPhoto: (photo: PhotoItem) => Promise<boolean>;
  onAddVideo: (video: VideoItem, fileBlob?: Blob) => Promise<boolean>;
  onAddPrivateVideo?: (video: PrivateVideoItem) => Promise<void>;
  onAddBatchMedia?: (
    items: Array<{
      type: 'photo' | 'video';
      photo?: PhotoItem;
      video?: VideoItem;
      blob?: Blob;
    }>,
    onProgress?: (completed: number, total: number, message: string) => void
  ) => Promise<{ succeeded: number; failed: number }>;
  currentPhotoCount: number;
  currentVideoCount: number;
  nextPhotoSlotNumber?: number;
  nextVideoSlotNumber?: number;
  nextPrivateSlotNumber?: number;
  defaultPrivateCoinPrice?: number;
  userProfile: UserProfile;
  onNavigateTab?: (tab: any) => void;
}

const CATEGORIES: CategoryType[] = [
  'Sexy',
  'Hot',
  'Call',
  'Glamour',
  'Portraits',
  'Nature',
  'Aesthetic',
  'Cinematic',
  'Urban',
  'Night',
  'Style'
];

const SAMPLE_PHOTO_PRESETS: { label: string; url: string; cat: CategoryType }[] = [];
const SAMPLE_VIDEO_PRESETS: { label: string; url: string; cat: CategoryType }[] = [];

export interface BatchItem {
  id: string;
  type: 'photo' | 'video';
  file?: File;
  sourceUrl?: string;
  thumbnailUrl: string;
  title: string;
  category: CategoryType;
  tags: string;
  duration?: string;
  blob?: Blob;
  status: 'pending' | 'processing' | 'done' | 'error';
  errorMessage?: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onAddPhoto,
  onAddVideo,
  onAddPrivateVideo,
  onAddBatchMedia,
  currentPhotoCount,
  currentVideoCount,
  nextPhotoSlotNumber,
  nextVideoSlotNumber,
  nextPrivateSlotNumber = 1,
  defaultPrivateCoinPrice = 50,
  userProfile,
  onNavigateTab,
}) => {
  const basePhotoSlot = Math.max(nextPhotoSlotNumber || 0, currentPhotoCount + 1);
  const baseVideoSlot = Math.max(nextVideoSlotNumber || 0, currentVideoCount + 1);
  // Mode: 'single' (individual slot) or 'batch' (upload all/multiple slots at once)
  const [uploadMode, setUploadMode] = useState<'single' | 'batch'>('batch');
  const [uploadTarget, setUploadTarget] = useState<'public' | 'private'>('public');
  const [privateTargetGalleries, setPrivateTargetGalleries] = useState<PrivateGalleryName[]>(['Global Adult']);
  const [privateCoinCost, setPrivateCoinCost] = useState<string>(String(defaultPrivateCoinPrice || 50));

  useEffect(() => {
    setPrivateCoinCost(String(defaultPrivateCoinPrice || 50));
  }, [defaultPrivateCoinPrice]);
  
  // Single mode state
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CategoryType>('Glamour');
  const [tags, setTags] = useState('New, Vibe, 2026');
  const [urlInput, setUrlInput] = useState('');
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState('0:30');

  // Batch mode state
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [visibleQueueCount, setVisibleQueueCount] = useState(25);
  const [batchGlobalCategory, setBatchGlobalCategory] = useState<CategoryType>('Glamour');
  const [batchGlobalTags, setBatchGlobalTags] = useState('SUZIKA, Hot, 2026');
  const [showMultiUrlInput, setShowMultiUrlInput] = useState(false);
  const [multiUrlText, setMultiUrlText] = useState('');
  const [batchProgress, setBatchProgress] = useState<{
    completed: number;
    total: number;
    percent?: number;
    message: string;
  } | null>(null);
  const [previewVideoItem, setPreviewVideoItem] = useState<BatchItem | null>(null);

  // Status states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [compressionNotice, setCompressionNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showStorageGuide, setShowStorageGuide] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // Clean up object URLs on unmount or file change
  useEffect(() => {
    return () => {
      if (videoBlobUrl) {
        URL.revokeObjectURL(videoBlobUrl);
      }
    };
  }, [videoBlobUrl]);

  if (!isOpen) return null;

  // Handle Tab Switching in Single Mode
  const handleSwitchTab = (tab: 'photo' | 'video') => {
    if (tab === mediaType) return;
    soundFX.playPop();
    setMediaType(tab);
    setErrorMessage(null);
    setCompressionNotice(null);
    setPreviewData(null);
    setSelectedPhotoFile(null);
    setSelectedVideoFile(null);
    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl(null);
    }
    setUrlInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Device File Selection Handler (Single Mode)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // If user selected multiple files in single mode, auto route to batch mode!
    if (files.length > 1) {
      handleBatchFilesSelected(files);
      setUploadMode('batch');
      return;
    }

    const file = files[0];
    setErrorMessage(null);
    setCompressionNotice(null);

    if (mediaType === 'photo') {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name);
      if (isVideo) {
        setErrorMessage('নির্বাচিত ফাইলটি একটি ভিডিও। ভিডিও আপলোড করতে উপরের Video Reel ট্যাবে যান।');
        return;
      }

      try {
        setIsProcessing(true);
        setSelectedPhotoFile(file);
        setSelectedVideoFile(null);
        setUrlInput('');

        const originalMb = (file.size / (1024 * 1024)).toFixed(2);
        setCompressionNotice(`ছবিটি প্রসেসিং করা হচ্ছে (${originalMb} MB)...`);

        let compressedBase64: string;
        try {
          compressedBase64 = await compressImageFile(file);
        } catch (compErr) {
          console.warn('Canvas compression fallback to direct FileReader:', compErr);
          compressedBase64 = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = rej;
            r.readAsDataURL(file);
          });
        }

        const compressedKb = Math.round((compressedBase64.length * 3) / 4 / 1024);
        setPreviewData(compressedBase64);
        setCompressionNotice(`✓ ছবি প্রস্তুত (${compressedKb} KB) · পারসিস্টেন্ট স্টোরেজের জন্য অপটিমাইজড`);

        if (!title.trim()) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
        }
      } catch (err: any) {
        console.error('Image processing error:', err);
        setErrorMessage(err?.message || 'ছবিটি প্রসেস করা সম্ভব হয়নি। অনুগ্রহ করে অন্য কোনো ছবি নির্বাচন করুন।');
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Video selection
      if (!file.type.startsWith('video/')) {
        setErrorMessage('নির্বাচিত ফাইলটি কোনো ভিডিও নয়। অনুগ্রহ করে MP4, WEBM বা MOV ভিডিও নির্বাচন করুন।');
        return;
      }

      try {
        setIsProcessing(true);
        setSelectedPhotoFile(null);
        setSelectedVideoFile(file);
        setUrlInput('');

        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        if (file.size > 250 * 1024 * 1024) {
          setErrorMessage('ভিডিও সাইজ ২৫০ MB এর বেশি। অনুগ্রহ করে ছোট ভিডিও ক্লিপ নির্বাচন করুন অথবা YouTube লিংক পেস্ট করুন।');
          setIsProcessing(false);
          return;
        }

        if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
        const objUrl = URL.createObjectURL(file);
        setVideoBlobUrl(objUrl);

        setCompressionNotice(`ভিডিও পরীক্ষা ও অটো-পোস্টার তৈরি হচ্ছে (${sizeMb} MB)...`);
        
        const meta = await extractVideoMeta(file);
        setPreviewData(meta.thumbnailUrl);
        setDuration(meta.durationStr);
        setCompressionNotice(`✓ ভিডিও প্রস্তুত (${sizeMb} MB, সময়: ${meta.durationStr}) · IndexedDB স্টোরেজে সংরক্ষিত হবে`);

        if (!title.trim()) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
        }
      } catch (err: any) {
        console.error('Video processing error:', err);
        setErrorMessage('ভিডিওটি প্রসেস করা যায়নি। অনুগ্রহ করে অন্য ভিডিও নির্বাচন করুন বা YouTube লিংক ব্যবহার করুন।');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Process multiple files for Batch Mode (Instant UI response, zero decoder overload!)
  const handleBatchFilesSelected = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setErrorMessage(null);
    setVisibleQueueCount(25);

    const newItems: BatchItem[] = files.map((file, i) => {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const itemTitle = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name);
      const itemId = isVideo
        ? `video-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`
        : `photo-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`;
      // Only create objectURL eagerly for photos (or lazily when previewing videos) to save memory on 100+ videos
      const photoPreviewUrl = !isVideo ? URL.createObjectURL(file) : '';

      return {
        id: itemId,
        type: isVideo ? 'video' : 'photo',
        file,
        sourceUrl: photoPreviewUrl,
        thumbnailUrl: photoPreviewUrl,
        title: itemTitle || (isVideo ? 'Video Reel' : 'Photo Slot'),
        category: batchGlobalCategory,
        tags: batchGlobalTags,
        duration: isVideo ? '0:30' : undefined,
        blob: file,
        status: 'pending',
      };
    });

    setBatchQueue((prev) => [...prev, ...newItems]);
    setIsProcessing(false);
    setCompressionNotice(
      `✓ সফলভাবে ${newItems.length}টি ফাইল কিউতে যুক্ত হয়েছে! নিচে লাল/গোলাপি পাবলিশ বাটনে চাপ দিয়ে আপলোড শুরু করুন।`
    );
    soundFX.playPop();

    // Extract thumbnail sequentially ONLY for first 6 videos so Chromium media decoders never stall
    const previewVideos = newItems.filter((it) => it.type === 'video' && it.file).slice(0, 6);
    if (previewVideos.length > 0) {
      (async () => {
        for (const item of previewVideos) {
          if (!item.file || isSubmittingRef.current) break;
          try {
            const meta = await extractVideoMeta(item.file, 2200);
            setBatchQueue((prev) =>
              prev.map((it) =>
                it.id === item.id
                  ? {
                      ...it,
                      thumbnailUrl: meta.thumbnailUrl || it.thumbnailUrl,
                      duration: meta.durationStr || it.duration,
                    }
                  : it
              )
            );
          } catch {}
        }
      })();
    }

    if (batchFileInputRef.current) {
      batchFileInputRef.current.value = '';
    }
  };

  // Add Multi URLs in batch
  const handleAddMultiUrls = () => {
    const lines = multiUrlText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('http://') || l.startsWith('https://'));

    if (lines.length === 0) {
      setErrorMessage('অনুগ্রহ করে অন্তত একটি সঠিক HTTP বা HTTPS লিংক দিন।');
      return;
    }

    const newItems: BatchItem[] = [];
    lines.forEach((url, idx) => {
      const yt = parseYouTubeUrl(url);
      const isVideo = yt.isYouTube || Boolean(url.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i));
      const itemId = `batch-url-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`;

      if (isVideo) {
        newItems.push({
          id: itemId,
          type: 'video',
          sourceUrl: url,
          thumbnailUrl: yt.isYouTube && yt.thumbnailUrl ? yt.thumbnailUrl : 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
          duration: '0:45',
          title: yt.isYouTube ? `YouTube Reel #${idx + 1}` : `Video Slot #${idx + 1}`,
          category: batchGlobalCategory,
          tags: batchGlobalTags,
          status: 'pending',
        });
      } else {
        newItems.push({
          id: itemId,
          type: 'photo',
          sourceUrl: url,
          thumbnailUrl: url,
          title: `Photo Slot #${idx + 1}`,
          category: batchGlobalCategory,
          tags: batchGlobalTags,
          status: 'pending',
        });
      }
    });

    setBatchQueue((prev) => [...prev, ...newItems]);
    setMultiUrlText('');
    setShowMultiUrlInput(false);
    soundFX.playSuccess();
    setCompressionNotice(`✓ ${newItems.length}টি লিংক কিউতে যুক্ত হয়েছে!`);
  };

  // Preset pack handler removed to ensure only real user uploads are used
  const handleAddPresetPack = () => {
    soundFX.playPop();
    setCompressionNotice('শুধুমাত্র আপনার নিজস্ব ডিভাইস থেকে ফাইল নির্বাচন করে আপলোড করুন।');
  };

  // URL Input Change & Live Validation in Single Mode
  const handleUrlInputChange = (val: string) => {
    setUrlInput(val);
    setErrorMessage(null);
    setCompressionNotice(null);

    if (!val.trim()) {
      if (!selectedPhotoFile && !selectedVideoFile) {
        setPreviewData(null);
      }
      return;
    }

    const trimmed = val.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return;
    }

    if (mediaType === 'video') {
      const yt = parseYouTubeUrl(trimmed);
      if (yt.isYouTube && yt.thumbnailUrl) {
        setPreviewData(yt.thumbnailUrl);
        setCompressionNotice('✓ YouTube ভিডিও লিংক শনাক্ত হয়েছে! পোস্টার ফ্রেম লোড হয়েছে।');
        if (!title.trim()) {
          setTitle('Featured YouTube Reel');
        }
      } else if (trimmed.match(/\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i)) {
        setPreviewData('https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80');
        setCompressionNotice('✓ সরাসরি MP4/WebM ভিডিও লিংক শনাক্ত হয়েছে!');
      }
    } else {
      if (trimmed.match(/\.(jpeg|jpg|png|webp|gif|svg)(\?.*)?$/i) || trimmed.includes('unsplash.com') || trimmed.includes('googleusercontent.com')) {
        setPreviewData(trimmed);
        setCompressionNotice('✓ ছবির লিংক প্রিভিউ লোড হয়েছে!');
      }
    }
  };

  // Validate URL thoroughly before submission
  const validateMediaUrl = async (url: string): Promise<boolean> => {
    const trimmed = url.trim();
    if (!trimmed) return false;

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setErrorMessage('লিংকটি অবশ্যই http:// বা https:// দিয়ে শুরু হতে হবে।');
        return false;
      }
    } catch {
      setErrorMessage('একটি সঠিক ও সম্পূর্ণ ইন্টারনেট ওয়েব লিংক দিন।');
      return false;
    }

    if (mediaType === 'photo') {
      setIsValidatingUrl(true);
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          setIsValidatingUrl(false);
          resolve(true);
        };
        img.onerror = () => {
          setIsValidatingUrl(false);
          setErrorMessage('ছবির লিংকটি লোড করা যাচ্ছে না। অনুগ্রহ করে একটি সঠিক ও উন্মুক্ত ছবির লিংক দিন (Direct Image URL)।');
          resolve(false);
        };
        img.src = trimmed;
      });
    } else {
      const yt = parseYouTubeUrl(trimmed);
      if (yt.isYouTube) return true;
      const isDirectVideo = trimmed.match(/\.(mp4|webm|mov|m4v|ogg|m3u8)(\?.*)?$/i);
      const isKnownMedia = trimmed.includes('commondatastorage.googleapis.com') || 
                           trimmed.includes('drive.google.com') || 
                           trimmed.includes('dropbox.com') ||
                           trimmed.includes('catbox.moe') ||
                           trimmed.includes('cloudinary.com');
      
      if (!isDirectVideo && !isKnownMedia) {
        if (!trimmed.startsWith('https://')) {
          setErrorMessage('অনুগ্রহ করে YouTube, Shorts বা সরাসরি MP4 ভিডিওর একটি সঠিক লিংক দিন।');
          return false;
        }
      }
      return true;
    }
  };

  // Clear single preview
  const handleClearPreview = () => {
    setPreviewData(null);
    setSelectedPhotoFile(null);
    setSelectedVideoFile(null);
    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl(null);
    }
    setUrlInput('');
    setCompressionNotice(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const togglePrivateGallery = (gallery: PrivateGalleryName) => {
    soundFX.playPop();
    setPrivateTargetGalleries((prev) => {
      if (prev.includes(gallery)) {
        return prev.length > 1 ? prev.filter((g) => g !== gallery) : prev;
      }
      return [...prev, gallery];
    });
  };

  const toggleSelectAllPrivateGalleries = () => {
    soundFX.playPop();
    if (privateTargetGalleries.length === PRIVATE_GALLERIES.length) {
      setPrivateTargetGalleries(['Global Adult']);
    } else {
      setPrivateTargetGalleries(PRIVATE_GALLERIES.map((g) => g.id));
    }
  };

  // Batch Form Submission: Publish all queued items to slots together
  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isProcessing || isSubmittingRef.current) return;
    if (batchQueue.length === 0) {
      setErrorMessage('কিউতে কোনো ছবি বা ভিডিও নেই। অনুগ্রহ করে প্রথমে ডিভাইস থেকে ফাইল নির্বাচন করুন বা লিংক দিন।');
      return;
    }

    if (uploadTarget === 'private' && onAddPrivateVideo) {
      const videoQueue = batchQueue.filter((item) => item.type === 'video');
      if (videoQueue.length === 0) {
        setErrorMessage('প্রাইভেট VIP গ্যালারিতে আপলোডের জন্য অন্তত একটি ভিডিও সিলেক্ট করুন।');
        return;
      }

      setErrorMessage(null);
      isSubmittingRef.current = true;
      setIsProcessing(true);
      soundFX.playPop();

      try {
        const targetGalleries: PrivateGalleryName[] =
          privateTargetGalleries.length > 0 ? privateTargetGalleries : ['Global Adult'];
        const coinCost = Math.max(0, parseInt(privateCoinCost, 10) || defaultPrivateCoinPrice || 50);
        const startPrivateSlot = Math.max(1, nextPrivateSlotNumber);
        const baseCreatedAtMs = Date.now();
        let succeededCount = 0;
        let failedCount = 0;
        let completedCount = 0;
        let lastFailureMsg = '';
        const succeededIds = new Set<string>();
        const itemFractions = new Float64Array(videoQueue.length);
        const CONCURRENCY = Math.min(4, videoQueue.length);
        let nextIndex = 0;

        const calcLivePercent = () => {
          let sum = 0;
          for (let k = 0; k < itemFractions.length; k++) sum += itemFractions[k];
          return Math.min(99, Math.max(1, Math.round((sum / Math.max(1, videoQueue.length)) * 100)));
        };

        setBatchProgress({
          completed: 0,
          total: videoQueue.length,
          percent: 1,
          message: `${CONCURRENCY}টি ভিডিও একসাথে দ্রুত ক্লাউডে আপলোড হচ্ছে (মোট ${videoQueue.length}টি)...`,
        });

        const runWorker = async () => {
          while (true) {
            const i = nextIndex++;
            if (i >= videoQueue.length) break;

            const item = videoQueue[i];
            const assignedSlot = startPrivateSlot + i;
            const pvId = `pv-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;

            try {
              let videoThumb = item.thumbnailUrl && !item.thumbnailUrl.startsWith('blob:') ? item.thumbnailUrl : '';
              let videoDuration = item.duration || '0:30';
              let finalVideoUrl = item.sourceUrl && !item.sourceUrl.startsWith('blob:') ? item.sourceUrl : '';
              let isCloudChunked = false;
              let cloudChunkCount: number | undefined;
              let fileSizeBytes: number | undefined;

              if (item.file) {
                if (item.file || item.blob) {
                  saveLocalVideoBlob(pvId, (item.blob || item.file)!).catch(() => {});
                }

                // Extract thumbnail & duration IN PARALLEL while uploading video data to cloud
                const metaPromise = !videoThumb
                  ? extractVideoMeta(item.file, 900).catch(() => null)
                  : Promise.resolve(null);

                const uploadPromise =
                  item.file.size <= MAX_INLINE_VIDEO_BYTES
                    ? blobToDataUrl(item.file).then((url) => {
                        itemFractions[i] = 0.9;
                        return { url, isChunked: false, totalChunks: undefined as number | undefined, sizeBytes: item.file!.size };
                      })
                    : uploadVideoToFirestoreChunks(
                        pvId,
                        item.file,
                        item.file.name,
                        (pct, msg) => {
                          itemFractions[i] = Math.min(0.95, pct / 100);
                          setBatchProgress({
                            completed: completedCount,
                            total: videoQueue.length,
                            percent: calcLivePercent(),
                            message: `Private #${assignedSlot}: ${msg} (${completedCount}/${videoQueue.length} সম্পন্ন)`,
                          });
                        },
                        4
                      ).then((res) => ({
                        url: res.streamUrl,
                        isChunked: true,
                        totalChunks: res.totalChunks,
                        sizeBytes: res.sizeBytes,
                      }));

                const [metaRes, upRes] = await Promise.all([metaPromise, uploadPromise]);
                if (metaRes) {
                  if (metaRes.thumbnailUrl && !metaRes.thumbnailUrl.startsWith('blob:')) {
                    videoThumb = metaRes.thumbnailUrl;
                  }
                  videoDuration = metaRes.durationStr || videoDuration;
                }
                finalVideoUrl = upRes.url;
                isCloudChunked = upRes.isChunked;
                cloudChunkCount = upRes.totalChunks;
                fileSizeBytes = upRes.sizeBytes;
              } else {
                const yt = parseYouTubeUrl(item.sourceUrl || '');
                finalVideoUrl = yt.isYouTube ? yt.embedUrl! : item.sourceUrl || '';
                if (yt.isYouTube && yt.thumbnailUrl) {
                  videoThumb = yt.thumbnailUrl;
                }
              }

              const newPv: PrivateVideoItem = {
                id: pvId,
                slotNumber: assignedSlot,
                title: item.title.trim() || `VIP Private #${assignedSlot}`,
                gallery: targetGalleries[0],
                galleries: targetGalleries,
                videoUrl: finalVideoUrl,
                thumbnailUrl: videoThumb,
                fallbackGradient: 'linear-gradient(135deg, #f43f5e, #f97316)',
                duration: videoDuration,
                coinPrice: coinCost,
                author: userProfile.name || 'Suzika VIP',
                views: 1,
                likes: generateInitialLikes(assignedSlot),
                createdAt: 'Just now',
                createdAtMs: baseCreatedAtMs + i,
                isCloudChunked,
                ...(cloudChunkCount !== undefined ? { cloudChunkCount } : {}),
                ...(fileSizeBytes !== undefined ? { fileSizeBytes } : {}),
              };

              await onAddPrivateVideo(newPv);
              succeededCount++;
              succeededIds.add(item.id);
            } catch (itemErr: any) {
              failedCount++;
              lastFailureMsg = itemErr?.message || 'ফাইল প্রসেস করা যায়নি';
              console.warn(`Private video #${i + 1} skipped:`, itemErr);
            }

            itemFractions[i] = 1;
            completedCount++;
            setBatchProgress({
              completed: completedCount,
              total: videoQueue.length,
              percent: Math.round((completedCount / Math.max(1, videoQueue.length)) * 100),
              message: `${completedCount}/${videoQueue.length}টি ভিডিও সম্পন্ন (${succeededCount}টি সেভ হয়েছে${failedCount > 0 ? `, ${failedCount}টি স্কিপ` : ''})`,
            });
          }
        };

        await Promise.all(Array.from({ length: CONCURRENCY }, () => runWorker()));

        if (succeededCount === 0) {
          setErrorMessage(
            lastFailureMsg || 'কোনো ভিডিও আপলোড করা যায়নি (প্রতি ভিডিও সর্বোচ্চ 40 MB হতে হবে)।'
          );
          setBatchProgress(null);
          return;
        }

        soundFX.playSuccess();
        if (failedCount > 0) {
          setBatchQueue((prev) => prev.filter((it) => !succeededIds.has(it.id)));
          setBatchProgress(null);
          setErrorMessage(
            `${succeededCount}টি ভিডিও সফলভাবে Private VIP গ্যালারিতে আপলোড হয়েছে, তবে ${failedCount}টি স্কিপ হয়েছে (${lastFailureMsg}).`
          );
        } else {
          setBatchQueue([]);
          setBatchProgress(null);
          if (onNavigateTab) {
            onNavigateTab('private');
          } else {
            onClose();
          }
        }
      } catch (err: any) {
        console.error('Private batch upload error:', err);
        setErrorMessage(err?.message || 'Private VIP আপলোডে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      } finally {
        setIsProcessing(false);
        isSubmittingRef.current = false;
      }
      return;
    }

    setErrorMessage(null);
    isSubmittingRef.current = true;
    setIsProcessing(true);
    soundFX.playPop();

    try {
      let photoSlotCounter = basePhotoSlot;
      let videoSlotCounter = baseVideoSlot;
      const itemSlots = batchQueue.map((item) =>
        item.type === 'photo' ? photoSlotCounter++ : videoSlotCounter++
      );
      const baseCreatedAtMs = Date.now();

      type BatchEntry = { type: 'photo' | 'video'; photo?: PhotoItem; video?: VideoItem; blob?: Blob };
      const results: Array<BatchEntry | null> = new Array(batchQueue.length).fill(null);
      const itemFractions = new Float64Array(batchQueue.length);
      const CONCURRENCY = Math.min(4, batchQueue.length);
      let nextIndex = 0;
      let completedCount = 0;

      const calcPublicPercent = () => {
        let sum = 0;
        for (let k = 0; k < itemFractions.length; k++) sum += itemFractions[k];
        return Math.min(99, Math.max(1, Math.round((sum / Math.max(1, batchQueue.length)) * 100)));
      };

      setBatchProgress({
        completed: 0,
        total: batchQueue.length,
        percent: 1,
        message: `${CONCURRENCY}টি স্লট একসাথে স্থায়ী ক্লাউডে আপলোড হচ্ছে (মোট ${batchQueue.length}টি)...`,
      });

      const runPublicWorker = async () => {
        while (true) {
          const i = nextIndex++;
          if (i >= batchQueue.length) break;

          const item = batchQueue[i];
          const assignedSlot = itemSlots[i];

          if (item.type === 'photo') {
            let photoSource = item.thumbnailUrl;
            if (item.file) {
              try {
                photoSource = await compressImageFile(item.file);
              } catch (compErr) {
                console.warn('Primary compression fallback, trying tighter resize:', compErr);
                try {
                  photoSource = await compressImageFile(item.file, 640, 0.58);
                } catch {
                  photoSource = await new Promise<string>((res, rej) => {
                    const r = new FileReader();
                    r.onload = () => res(r.result as string);
                    r.onerror = rej;
                    r.readAsDataURL(item.file!);
                  });
                }
              }
            }
            if (photoSource && !photoSource.startsWith('blob:')) {
              const photoCategory = item.category || batchGlobalCategory || 'Style';
              const isPhotoLockedCategory = photoCategory === 'Sexy' || photoCategory === 'Hot' || photoCategory === 'Call';
              const photo: PhotoItem = {
                id: item.id.startsWith('photo-') ? item.id : `photo-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`,
                slotNumber: assignedSlot,
                title: item.title.trim() || `Photo Slot #${assignedSlot}`,
                category: photoCategory,
                imageUrl: photoSource,
                fallbackGradient: 'linear-gradient(135deg, #ff35bb, #8b4dff)',
                author: userProfile.name || 'Suzika Creator',
                views: 1,
                likes: generateInitialLikes(assignedSlot),
                isLiked: false,
                isLocked: isPhotoLockedCategory,
                tags: item.tags ? item.tags.split(',').map((t) => t.trim()).filter(Boolean) : ['Suzika', 'Style'],
                resolution: 'FullHD · 1080p',
                createdAt: 'Just now',
                createdAtMs: baseCreatedAtMs + i,
                comments: [],
              };
              results[i] = { type: 'photo', photo };
            }
          } else {
            let videoThumb = item.thumbnailUrl && !item.thumbnailUrl.startsWith('blob:') ? item.thumbnailUrl : '';
            let videoDuration = item.duration || '0:30';
            let videoUrl = item.sourceUrl && !item.sourceUrl.startsWith('blob:') ? item.sourceUrl : '';
            let isCloudChunked = false;
            let cloudChunkCount: number | undefined;
            let fileSizeBytes: number | undefined;
            const videoId = item.id.startsWith('video-') ? item.id : `video-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`;

            if (item.file) {
              if (item.file || item.blob) {
                saveLocalVideoBlob(videoId, (item.blob || item.file)!).catch(() => {});
              }

              const metaPromise = !videoThumb
                ? extractVideoMeta(item.file, 900).catch(() => null)
                : Promise.resolve(null);

              const uploadPromise =
                item.file.size <= MAX_INLINE_VIDEO_BYTES
                  ? blobToDataUrl(item.file).then((url) => {
                      itemFractions[i] = 0.9;
                      return { url, isChunked: false, totalChunks: undefined as number | undefined, sizeBytes: item.file!.size };
                    })
                  : uploadVideoToFirestoreChunks(
                      videoId,
                      item.file,
                      item.file.name,
                      (pct, msg) => {
                        itemFractions[i] = Math.min(0.95, pct / 100);
                        setBatchProgress({
                          completed: completedCount,
                          total: batchQueue.length,
                          percent: calcPublicPercent(),
                          message: `ভিডিও #${assignedSlot}: ${msg}`,
                        });
                      },
                      4
                    ).then((res) => ({
                      url: res.streamUrl,
                      isChunked: true,
                      totalChunks: res.totalChunks,
                      sizeBytes: res.sizeBytes,
                    }));

              const [metaRes, upRes] = await Promise.all([metaPromise, uploadPromise]);
              if (metaRes) {
                if (metaRes.thumbnailUrl && !metaRes.thumbnailUrl.startsWith('blob:')) {
                  videoThumb = metaRes.thumbnailUrl;
                }
                videoDuration = metaRes.durationStr || videoDuration;
              }
              videoUrl = upRes.url;
              isCloudChunked = upRes.isChunked;
              cloudChunkCount = upRes.totalChunks;
              fileSizeBytes = upRes.sizeBytes;
            }

            const yt = parseYouTubeUrl(item.sourceUrl || '');
            const finalVideoUrl = videoUrl || (yt.isYouTube ? yt.embedUrl! : (item.sourceUrl && !item.sourceUrl.startsWith('blob:') ? item.sourceUrl : ''));
            const videoCategory = item.category || batchGlobalCategory || 'Cinematic';
            const isVideoLockedCategory = videoCategory === 'Sexy' || videoCategory === 'Hot' || videoCategory === 'Call';

            const video: VideoItem = {
              id: videoId,
              slotNumber: assignedSlot,
              title: item.title.trim() || `Video Reel #${assignedSlot}`,
              category: videoCategory,
              videoUrl: finalVideoUrl,
              thumbnailUrl: yt.isYouTube && yt.thumbnailUrl ? yt.thumbnailUrl : videoThumb,
              fallbackGradient: 'linear-gradient(135deg, #8b4dff, #00d2ff)',
              duration: videoDuration,
              views: 1,
              likes: generateInitialLikes(assignedSlot),
              isLiked: false,
              isLocked: isVideoLockedCategory,
              author: userProfile.name || 'Suzika Creator',
              tags: item.tags ? item.tags.split(',').map((t) => t.trim()).filter(Boolean) : ['Suzika', 'Reels'],
              createdAt: 'Just now',
              createdAtMs: baseCreatedAtMs + i,
              isLocalIndexedDB: false,
              isCloudChunked,
              ...(cloudChunkCount !== undefined ? { cloudChunkCount } : {}),
              ...(fileSizeBytes !== undefined ? { fileSizeBytes } : {}),
              videoType: item.file ? 'direct' : (yt.isYouTube ? 'youtube' : 'direct'),
            };
            results[i] = { type: 'video', video, blob: item.blob || item.file };
          }

          itemFractions[i] = 1;
          completedCount++;
          setBatchProgress({
            completed: completedCount,
            total: batchQueue.length,
            percent: Math.round((completedCount / Math.max(1, batchQueue.length)) * 100),
            message: `প্রস্তুত ও ক্লাউড আপলোড সম্পন্ন (${completedCount}/${batchQueue.length})...`,
          });
        }
      };

      await Promise.all(Array.from({ length: CONCURRENCY }, () => runPublicWorker()));
      const batchPayload: BatchEntry[] = results.filter((entry): entry is BatchEntry => entry !== null);

      if (onAddBatchMedia) {
        await onAddBatchMedia(batchPayload, (completed, total, message) => {
          setBatchProgress({ completed, total, message });
        });
      } else {
        for (let i = 0; i < batchPayload.length; i++) {
          const p = batchPayload[i];
          setBatchProgress({
            completed: i,
            total: batchPayload.length,
            message: `স্লট #${p.type === 'photo' ? p.photo?.slotNumber : p.video?.slotNumber} আপলোড হচ্ছে...`,
          });
          if (p.type === 'photo' && p.photo) {
            await onAddPhoto(p.photo);
          } else if (p.type === 'video' && p.video) {
            await onAddVideo(p.video, p.blob);
          }
        }
      }

      soundFX.playSuccess();
      setBatchQueue([]);
      setBatchProgress(null);
      if (onNavigateTab) {
        onNavigateTab('gallery');
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error('Batch upload error:', err);
      setErrorMessage(err?.message || 'একসাথে স্লট আপলোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setIsProcessing(false);
      isSubmittingRef.current = false;
    }
  };

  // Single Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isProcessing || isSubmittingRef.current) return;
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('অনুগ্রহ করে আপলোডের একটি শিরোনাম (Title) দিন।');
      return;
    }

    const hasDeviceFile = mediaType === 'photo' ? Boolean(previewData || selectedPhotoFile) : Boolean(selectedVideoFile);
    const hasUrl = Boolean(urlInput.trim());

    if (!hasDeviceFile && !hasUrl) {
      setErrorMessage(
        mediaType === 'photo'
          ? 'অনুগ্রহ করে ডিভাইস থেকে একটি ছবি নির্বাচন করুন অথবা ছবির সরাসরি লিংক দিন।'
          : 'অনুগ্রহ করে ডিভাইস থেকে একটি ভিডিও ফাইল নির্বাচন করুন অথবা YouTube/MP4 লিংক দিন।'
      );
      return;
    }

    if (!hasDeviceFile && hasUrl) {
      const isValid = await validateMediaUrl(urlInput.trim());
      if (!isValid) return;
    }

    isSubmittingRef.current = true;
    setIsProcessing(true);

    try {
      if (mediaType === 'photo') {
        let photoSource = previewData || urlInput.trim();
        if (selectedPhotoFile && (!photoSource || !photoSource.startsWith('data:image/'))) {
          try {
            photoSource = await compressImageFile(selectedPhotoFile);
          } catch {
            try {
              photoSource = await compressImageFile(selectedPhotoFile, 640, 0.58);
            } catch {
              const serverUrl = await uploadMediaToServer(selectedPhotoFile, 'photo');
              if (serverUrl) {
                photoSource = serverUrl;
              }
            }
          }
        }
        const photoSlotNum = basePhotoSlot;

        const isLockedCategory = category === 'Sexy' || category === 'Hot' || category === 'Call';

        const newPhoto: PhotoItem = {
          id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          slotNumber: photoSlotNum,
          title: title.trim(),
          category,
          imageUrl: photoSource,
          fallbackGradient: 'linear-gradient(135deg, #ff35bb, #8b4dff)',
          author: userProfile.name || 'SUZIKA Creator',
          views: 1,
          likes: generateInitialLikes(photoSlotNum),
          isLiked: false,
          isLocked: isLockedCategory,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          resolution: 'FullHD · 1080p',
          createdAt: 'Just now',
          createdAtMs: Date.now(),
          comments: [],
        };

        await onAddPhoto(newPhoto);
      } else {
        const videoId = `video-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const videoSlotNum = baseVideoSlot;
        const cleanUrl = urlInput.trim();
        const yt = parseYouTubeUrl(cleanUrl);
        const isLockedCategory = category === 'Sexy' || category === 'Hot' || category === 'Call';

        if (selectedVideoFile) {
          let finalVideoUrl = '';
          let isCloudChunked = false;
          let cloudChunkCount: number | undefined;
          let fileSizeBytes: number | undefined;

          if (selectedVideoFile.size <= MAX_INLINE_VIDEO_BYTES) {
            finalVideoUrl = await blobToDataUrl(selectedVideoFile);
          } else {
            const cloudRes = await uploadVideoToFirestoreChunks(
              videoId,
              selectedVideoFile,
              selectedVideoFile.name,
              (_pct, msg) => setCompressionNotice(msg)
            );
            finalVideoUrl = cloudRes.streamUrl;
            isCloudChunked = true;
            cloudChunkCount = cloudRes.totalChunks;
            fileSizeBytes = cloudRes.sizeBytes;
          }

          const newVideo: VideoItem = {
            id: videoId,
            slotNumber: videoSlotNum,
            title: title.trim(),
            category,
            videoUrl: finalVideoUrl,
            thumbnailUrl: previewData || '',
            fallbackGradient: 'linear-gradient(135deg, #8b4dff, #00d2ff)',
            duration: duration || '0:30',
            views: 1,
            likes: generateInitialLikes(videoSlotNum),
            isLiked: false,
            isLocked: isLockedCategory,
            author: userProfile.name || 'SUZIKA Creator',
            tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
            createdAt: 'Just now',
            createdAtMs: Date.now(),
            isLocalIndexedDB: false,
            isCloudChunked,
            ...(cloudChunkCount !== undefined ? { cloudChunkCount } : {}),
            ...(fileSizeBytes !== undefined ? { fileSizeBytes } : {}),
            videoType: 'direct',
          };

          await onAddVideo(newVideo, selectedVideoFile);
        } else {
          const newVideo: VideoItem = {
            id: videoId,
            slotNumber: videoSlotNum,
            title: title.trim(),
            category,
            videoUrl: yt.isYouTube ? yt.embedUrl! : cleanUrl,
            thumbnailUrl: yt.isYouTube && yt.thumbnailUrl ? yt.thumbnailUrl : (previewData || ''),
            fallbackGradient: 'linear-gradient(135deg, #8b4dff, #00d2ff)',
            duration: duration || '0:30',
            views: 1,
            likes: generateInitialLikes(videoSlotNum),
            isLiked: false,
            isLocked: isLockedCategory,
            author: userProfile.name || 'SUZIKA Creator',
            tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
            createdAt: 'Just now',
            createdAtMs: Date.now(),
            videoType: yt.isYouTube ? 'youtube' : 'direct',
          };

          await onAddVideo(newVideo);
        }
      }

      soundFX.playSuccess();
      onClose();
      
      setTitle('');
      setUrlInput('');
      setPreviewData(null);
      setSelectedPhotoFile(null);
      setSelectedVideoFile(null);
      if (videoBlobUrl) {
        URL.revokeObjectURL(videoBlobUrl);
        setVideoBlobUrl(null);
      }
      setCompressionNotice(null);
    } catch (err: any) {
      console.error('Submit upload error:', err);
      setErrorMessage(
        err?.message || 'আপলোড সংরক্ষণ করতে সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।'
      );
    } finally {
      setIsProcessing(false);
      isSubmittingRef.current = false;
    }
  };

  const nextSlotNumber = mediaType === 'photo' ? basePhotoSlot : baseVideoSlot;
  const remainingSlots = mediaType === 'photo' ? Math.max(0, 500 - currentPhotoCount) : Math.max(0, 500 - currentVideoCount);

  // Batch counters
  const batchPhotoCount = batchQueue.filter((b) => b.type === 'photo').length;
  const batchVideoCount = batchQueue.filter((b) => b.type === 'video').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#111522] border border-[#252a3d] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl my-auto animate-in fade-in duration-200 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#252a3d] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff35bb] to-[#8b4dff] flex items-center justify-center text-white shadow-md shadow-[#ff35bb]/20">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-white">Upload to Gallery</h2>
              <p className="text-xs text-[#9da4b8]">
                {uploadMode === 'batch' 
                  ? `একসাথে একাধিক বা সব স্লটে ছবি ও ভিডিও আপলোড (${batchQueue.length} queued)`
                  : `Slot #${nextSlotNumber} of 500 available (${remainingSlots} remaining)`
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowStorageGuide(!showStorageGuide)}
              title="স্টোরেজ ও আনলিমিটেড আপলোড নির্দেশিকা"
              className="px-2.5 py-1 rounded-xl bg-[#1e2338] hover:bg-[#28314e] text-amber-300 border border-amber-400/30 text-xs font-bold flex items-center gap-1 transition-all"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">স্টোরেজ তথ্য</span>
            </button>
            <button
              onClick={() => {
                soundFX.playPop();
                onClose();
              }}
              disabled={isProcessing}
              className="w-8 h-8 rounded-full bg-[#161a2b] hover:bg-[#252a3d] text-white flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Shortcut to View Existing Uploads in Gallery */}
        <div className="mt-3 p-2.5 rounded-2xl bg-gradient-to-r from-[#1c1433] via-[#12192e] to-[#112433] border border-[#ff35bb]/40 flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-base">🖼️</span>
            <div>
              <span className="font-bold text-white">পূর্বে আপলোড করা ছবি দেখতে চান?</span>
              <p className="text-[10px] text-[#00d2ff]">আপনার মোট {currentPhotoCount}টি স্লট গ্যালারিতে সংরক্ষিত আছে</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              if (onNavigateTab) {
                onNavigateTab('gallery');
              } else {
                onClose();
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white font-bold text-xs shadow-md shadow-[#ff35bb]/30 hover:opacity-95 active:scale-95 transition-all shrink-0"
          >
            গ্যালারি খুলুন →
          </button>
        </div>

        {/* Primary Mode Toggle: Single Slot vs Batch / All Slots Upload */}
        <div className="grid grid-cols-2 gap-2 mt-2.5 p-1 bg-[#0b0e18] border border-[#ff35bb]/30 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              setUploadMode('batch');
            }}
            disabled={isProcessing}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              uploadMode === 'batch'
                ? 'bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white shadow-md shadow-[#ff35bb]/30'
                : 'text-[#9da4b8] hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>⚡ একসাথে সব স্লট আপলোড (Batch Slots)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playPop();
              setUploadMode('single');
            }}
            disabled={isProcessing}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              uploadMode === 'single'
                ? 'bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white shadow-md shadow-[#ff35bb]/30'
                : 'text-[#9da4b8] hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>একক স্লট আপলোড (Single Slot)</span>
          </button>
        </div>

        {/* Collapsible Storage Information Box */}
        {showStorageGuide && (
          <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-[#17122b] via-[#101426] to-[#121b29] border border-amber-400/40 text-xs text-[#d5cce7] space-y-2 animate-in fade-in shrink-0">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
              <HardDrive className="w-4 h-4" />
              <span>পারসিস্টেন্ট স্টোরেজ ও মিডিয়া সেভ করার নিয়ম:</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-[11px] leading-relaxed text-[#c3cadb]">
              <li>
                <b className="text-white">১. স্থায়ী IndexedDB স্টোরেজ:</b> আপনার আপলোড করা ছবি ও ভিডিও ডিভাইসের স্থায়ী IndexedDB স্টোরেজে সেভ হয়, যা পেইজ রিফ্রেশ করলেও হারায় না।
              </li>
              <li>
                <b className="text-white">২. বাল্ক / একসাথে সব স্লট:</b> এক ক্লিকেই ১০-২০টি ছবি এবং ভিডিও একসাথে সিলেক্ট করে সবগুলো স্লটে একসাথে পাবলিশ করতে পারেন।
              </li>
              <li>
                <b className="text-white">৩. YouTube ও Shorts সাপোর্ট:</b> যেকোনো YouTube ভিডিও বা Shorts লিংক দিয়েও সরাসরি একাধিক ভিডিও রিল স্লট তৈরি করা যায়।
              </li>
            </ul>
          </div>
        )}

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto pr-1 flex-1 mt-3">

          {/* ========================================================= */}
          {/* BATCH / ALL SLOTS UPLOAD MODE */}
          {/* ========================================================= */}
          {uploadMode === 'batch' && (
            <div className="space-y-4">
              {/* Admin Target Switcher: Public Gallery/Videos vs Private VIP (18+) */}
              {onAddPrivateVideo && (
                <div className="p-3 rounded-2xl bg-[#0e1220] border border-rose-500/35 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        soundFX.playPop();
                        setUploadTarget('public');
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        uploadTarget === 'public'
                          ? 'bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white shadow-md'
                          : 'bg-[#161a2b] text-[#9da4b8] hover:text-white border border-[#252a3d]'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>পাবলিক গ্যালারি ও ভিডিও</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        soundFX.playPop();
                        setUploadTarget('private');
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        uploadTarget === 'private'
                          ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md shadow-rose-500/25'
                          : 'bg-[#161a2b] text-rose-200/80 hover:text-white border border-rose-500/30'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>প্রাইভেট VIP (18+) গ্যালারি</span>
                    </button>
                  </div>

                  {uploadTarget === 'private' && (
                    <div className="space-y-2.5 pt-2 border-t border-[#252a3d] animate-in fade-in">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-rose-300 flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5" />
                          কোন Private গ্যালারিতে যাবে? ({privateTargetGalleries.length}/{PRIVATE_GALLERIES.length})
                        </span>
                        <button
                          type="button"
                          onClick={toggleSelectAllPrivateGalleries}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                            privateTargetGalleries.length === PRIVATE_GALLERIES.length
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/15 text-rose-200 border-rose-500/30 hover:bg-rose-500/25'
                          }`}
                        >
                          {privateTargetGalleries.length === PRIVATE_GALLERIES.length
                            ? '✓ সব গ্যালারি সিলেক্টেড'
                            : 'সব গ্যালারি (All Select)'}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {PRIVATE_GALLERIES.map((gObj) => {
                          const selected = privateTargetGalleries.includes(gObj.id);
                          return (
                            <button
                              key={gObj.id}
                              type="button"
                              onClick={() => togglePrivateGallery(gObj.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 ${
                                selected
                                  ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white border-transparent shadow-sm'
                                  : 'bg-[#161a2b] text-[#9da4b8] border-[#252a3d] hover:text-white'
                              }`}
                            >
                              {selected && <Check className="w-3 h-3" />}
                              <span>{gObj.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <label className="text-[11px] text-[#9da4b8] flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-amber-400" />
                          <span>Unlock Coin Price:</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={privateCoinCost}
                          onChange={(e) => setPrivateCoinCost(e.target.value)}
                          className="w-28 bg-[#161a2b] border border-amber-500/30 focus:border-amber-400 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-bold text-center focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Informational Banner */}
              <div className={`p-3 rounded-2xl bg-gradient-to-r from-[#161a2b] via-[#1f1738] to-[#121629] border ${uploadTarget === 'private' ? 'border-rose-500/40' : 'border-[#ff35bb]/40'}`}>
                <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
                  {uploadTarget === 'private' ? (
                    <>
                      <Flame className="w-4 h-4 text-rose-400" />
                      <span>Private VIP গ্যালারিতে একসাথে সব ভিডিও আপলোড (All Select):</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#ff35bb]" />
                      <span>একসাথে সব স্লটে ছবি ও ভিডিও আপলোড করার নিয়ম:</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-[#b8c2d8] leading-relaxed">
                  {uploadTarget === 'private'
                    ? 'ডিভাইস থেকে Ctrl + A চেপে একাধিক ভিডিও সিলেক্ট করুন। সব ভিডিও ব্লার থাকবে — ইউজাররা প্রথম ২ সেকেন্ড ফ্রি দেখার পর আপনার নির্ধারিত Coin দিয়ে আনলক করবে।'
                    : `ডিভাইসের গ্যালারি বা ফোল্ডার থেকে একসাথে একাধিক ছবি এবং ভিডিও নির্বাচন করুন। প্রতিটি মিডিয়ার জন্য স্বয়ংক্রিয়ভাবে পরবর্তী ধারাবাহিক স্লট নম্বর বরাদ্দ হবে (যেমন: ফটো Slot #${basePhotoSlot}, #${basePhotoSlot + 1}... / ভিডিও Slot #${baseVideoSlot}...) এবং স্থায়ীভাবে ক্লাউডে সেভ হবে।`}
                </p>
              </div>

              {/* Action Buttons for Adding Media */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* File picker button for multiple files */}
                <button
                  type="button"
                  onClick={() => batchFileInputRef.current?.click()}
                  disabled={isProcessing}
                  className={`py-3 px-3 rounded-xl border text-white flex flex-col items-center justify-center gap-1 transition-all group disabled:opacity-50 ${
                    uploadTarget === 'private'
                      ? 'bg-gradient-to-r from-rose-500/20 to-orange-500/20 hover:from-rose-500/30 hover:to-orange-500/30 border-rose-500/60'
                      : 'bg-gradient-to-r from-[#ff35bb]/20 to-[#8b4dff]/20 hover:from-[#ff35bb]/30 hover:to-[#8b4dff]/30 border-[#ff35bb]/60'
                  }`}
                >
                  <Upload className={`w-5 h-5 group-hover:scale-110 transition-transform ${uploadTarget === 'private' ? 'text-rose-400' : 'text-[#ff35bb]'}`} />
                  <span className="text-xs font-bold">
                    {uploadTarget === 'private' ? 'একাধিক VIP ভিডিও বাছুন' : 'একাধিক ছবি ও ভিডিও বাছুন'}
                  </span>
                  <span className="text-[10px] text-amber-300 font-semibold">Ctrl + A চেপে All Select করুন</span>
                </button>
                <input
                  ref={batchFileInputRef}
                  type="file"
                  multiple
                  accept={
                    uploadTarget === 'private'
                      ? 'video/*,.mp4,.webm,.mov,.m4v'
                      : 'image/*,video/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.jfif,.220,.mp4,.webm,.mov'
                  }
                  onChange={(e) => {
                    if (e.target.files) handleBatchFilesSelected(e.target.files);
                  }}
                  disabled={isProcessing}
                  className="hidden"
                />

                {/* Multi URLs Modal Trigger */}
                <button
                  type="button"
                  onClick={() => setShowMultiUrlInput(!showMultiUrlInput)}
                  disabled={isProcessing}
                  className="py-3 px-3 rounded-xl bg-[#161a2b] hover:bg-[#202742] border border-[#252a3d] text-white flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50"
                >
                  <LinkIcon className="w-5 h-5 text-[#00d2ff]" />
                  <span className="text-xs font-bold">একাধিক লিংক পেস্ট করুন</span>
                  <span className="text-[10px] text-[#9da4b8]">YouTube / ওয়েব লিংক</span>
                </button>

              </div>

              {/* Expandable Multi-URL Input Box */}
              {showMultiUrlInput && (
                <div className="p-3.5 bg-[#0b0e18] border border-[#00d2ff]/40 rounded-2xl space-y-2 animate-in fade-in">
                  <label className="block text-xs font-bold text-white flex items-center justify-between">
                    <span>প্রতি লাইনে একটি করে ছবির লিংক বা YouTube ভিডিও লিংক পেস্ট করুন:</span>
                    <button
                      type="button"
                      onClick={() => setShowMultiUrlInput(false)}
                      className="text-xs text-[#9da4b8] hover:text-white"
                    >
                      বন্ধ করুন
                    </button>
                  </label>
                  <textarea
                    rows={4}
                    value={multiUrlText}
                    onChange={(e) => setMultiUrlText(e.target.value)}
                    placeholder="https://images.unsplash.com/...&#10;https://youtu.be/...&#10;https://commondatastorage.googleapis.com/...mp4"
                    className="w-full bg-[#121626] border border-[#252a3d] rounded-xl p-2.5 text-xs text-white placeholder-[#9da4b8]/40 focus:outline-none focus:border-[#00d2ff] font-mono"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleAddMultiUrls}
                      className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#00d2ff] to-[#8b4dff] text-black font-bold text-xs shadow-md"
                    >
                      কিউতে যোগ করুন (Add to Queue)
                    </button>
                  </div>
                </div>
              )}

              {/* Compression or Optimization Notice */}
              {compressionNotice && (
                <div className="p-2.5 bg-emerald-950/40 rounded-xl border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-400 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-medium text-[11px]">{compressionNotice}</span>
                </div>
              )}

              {/* Error Message Banner */}
              {errorMessage && (
                <div className="p-2.5 bg-red-950/40 rounded-xl border border-red-500/40 flex items-start gap-2 text-xs text-red-300 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              {/* Batch Queue Status & Global Settings */}
              {batchQueue.length > 0 && (
                <div className="p-3 rounded-2xl bg-[#0e1220] border border-[#252a3d] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#252a3d] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        আপলোডের জন্য প্রস্তুত: <span className="text-[#ff35bb]">{batchQueue.length}টি মিডিয়া</span>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ff35bb]/20 text-[#ff8ce4] font-mono font-bold">
                        {batchPhotoCount}টি ফটো · {batchVideoCount}টি ভিডিও
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBatchQueue([])}
                      disabled={isProcessing}
                      className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
                    >
                      সব মুছুন
                    </button>
                  </div>

                  {/* Quick Bulk Settings applied to all items */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] text-[#9da4b8] mb-1">সবার জন্য ক্যাটাগরি:</label>
                      <select
                        value={batchGlobalCategory}
                        disabled={isProcessing}
                        onChange={(e) => {
                          const newCat = e.target.value as CategoryType;
                          setBatchGlobalCategory(newCat);
                          setBatchQueue((prev) => prev.map((item) => ({ ...item, category: newCat })));
                        }}
                        className="w-full bg-[#161a2b] border border-[#252a3d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat === 'Sexy' ? '🔞 Sexy (Blur & Ad Unlock)' : cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#9da4b8] mb-1">সবার জন্য ট্যাগ:</label>
                      <input
                        type="text"
                        value={batchGlobalTags}
                        disabled={isProcessing}
                        onChange={(e) => {
                          const newTags = e.target.value;
                          setBatchGlobalTags(newTags);
                          setBatchQueue((prev) => prev.map((item) => ({ ...item, tags: newTags })));
                        }}
                        className="w-full bg-[#161a2b] border border-[#252a3d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>

                    {batchGlobalCategory === 'Sexy' && (
                      <div className="col-span-2 p-2.5 rounded-xl bg-[#ff35bb]/15 border border-[#ff35bb]/40 text-[11px] text-[#ff80d5] flex items-start gap-2 animate-in fade-in">
                        <span className="font-bold text-base leading-none">🔞</span>
                        <div className="space-y-0.5">
                          <strong className="text-white block font-bold">Sexy ক্যাটাগরি স্বয়ংক্রিয় ব্লার নীতি:</strong>
                          <p className="text-[#ffb3e6] leading-tight">
                            এই ক্যাটাগরির সমস্ত ছবি ও ভিডিও গ্যালারিতে ব্লার (Blur) থাকবে। দর্শকরা ৩০ সেকেন্ড রিওয়ার্ডেড বিজ্ঞাপন সম্পূর্ণ দেখার পর কন্টেন্টটি আনব্লার ও দেখা যাবে।
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* List of items in queue (windowed for instant UI with 100+ files, no heavy <video> tags) */}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {(() => {
                      let pCounter = basePhotoSlot;
                      let vCounter = baseVideoSlot;
                      const slotNumbers = batchQueue.map((qItem) =>
                        qItem.type === 'photo' ? pCounter++ : vCounter++
                      );
                      const visibleItems = batchQueue.slice(0, visibleQueueCount);

                      return (
                        <>
                          {visibleItems.map((item, index) => {
                            const slotNum = slotNumbers[index];

                            return (
                              <div
                                key={item.id}
                                className="flex items-center gap-2.5 p-2 rounded-xl bg-[#141829] border border-[#252a3d] hover:border-[#ff35bb]/40 transition-colors"
                              >
                                <div
                                  onClick={() => {
                                    if (item.type === 'video') {
                                      soundFX.playPop();
                                      const playItem =
                                        !item.sourceUrl && item.file
                                          ? { ...item, sourceUrl: URL.createObjectURL(item.file) }
                                          : item;
                                      setPreviewVideoItem(playItem);
                                    }
                                  }}
                                  className={`relative w-14 h-14 rounded-xl overflow-hidden bg-black shrink-0 border border-[#252a3d] ${item.type === 'video' ? 'cursor-pointer group hover:border-[#ff35bb]/60 ring-2 ring-transparent hover:ring-[#ff35bb]/30' : ''}`}
                                  title={item.type === 'video' ? 'ভিডিওটি প্লে করে দেখার জন্য ক্লিক করুন' : undefined}
                                >
                                  {item.type === 'video' ? (
                                    item.thumbnailUrl && !item.thumbnailUrl.startsWith('blob:') ? (
                                      <img
                                        src={item.thumbnailUrl}
                                        alt="Video Preview"
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gradient-to-br from-[#231538] to-[#111524] flex items-center justify-center">
                                        <Film className="w-5 h-5 text-[#ff8ce4]/80" />
                                      </div>
                                    )
                                  ) : (
                                    <img
                                      src={item.thumbnailUrl}
                                      alt="Item"
                                      loading="lazy"
                                      decoding="async"
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  {item.type === 'video' && (
                                    <div className="absolute inset-0 bg-black/35 group-hover:bg-[#ff35bb]/40 flex items-center justify-center transition-all">
                                      <div className="w-6 h-6 rounded-full bg-white/20 group-hover:bg-white text-white group-hover:text-[#ff35bb] flex items-center justify-center shadow">
                                        <Play className="w-3 h-3 fill-current ml-0.5" />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                                      item.type === 'photo'
                                        ? 'bg-[#ff35bb]/20 text-[#ff8ce4] border border-[#ff35bb]/30'
                                        : 'bg-[#8b4dff]/20 text-[#c7a6ff] border border-[#8b4dff]/30'
                                    }`}>
                                      {item.type === 'photo' ? `Photo Slot #${slotNum}` : `Video Slot #${slotNum}`}
                                    </span>
                                    {item.duration && (
                                      <span className="text-[9px] text-[#9da4b8] font-mono">
                                        {item.duration}
                                      </span>
                                    )}
                                    {item.type === 'video' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          soundFX.playPop();
                                          const playItem =
                                            !item.sourceUrl && item.file
                                              ? { ...item, sourceUrl: URL.createObjectURL(item.file) }
                                              : item;
                                          setPreviewVideoItem(playItem);
                                        }}
                                        className="px-2 py-0.5 rounded-md bg-[#ff35bb]/20 hover:bg-[#ff35bb]/35 text-[#ff8ce4] hover:text-white border border-[#ff35bb]/40 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                                        title="ভিডিও প্লে করুন ও প্রিভিউ দেখুন"
                                      >
                                        <Play className="w-2.5 h-2.5 fill-current" />
                                        <span>ভিডিও প্লে করুন</span>
                                      </button>
                                    )}
                                  </div>
                                  <input
                                    type="text"
                                    value={item.title}
                                    disabled={isProcessing}
                                    onChange={(e) => {
                                      const newTitle = e.target.value;
                                      setBatchQueue((prev) =>
                                        prev.map((it) => (it.id === item.id ? { ...it, title: newTitle } : it))
                                      );
                                    }}
                                    className="w-full bg-transparent border-b border-transparent focus:border-[#ff35bb] text-xs text-white font-medium focus:outline-none truncate"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setBatchQueue((prev) => prev.filter((it) => it.id !== item.id));
                                  }}
                                  disabled={isProcessing}
                                  className="p-1.5 rounded-lg text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}

                          {batchQueue.length > visibleQueueCount && (
                            <button
                              type="button"
                              onClick={() => setVisibleQueueCount((c) => c + 30)}
                              className="w-full py-2 rounded-xl bg-[#161a2b] hover:bg-[#20263f] border border-[#252a3d] text-xs font-bold text-[#00d2ff] transition-colors"
                            >
                              আরও দেখুন ({batchQueue.length - visibleQueueCount}টি বাকি)
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Progress bar during batch execution */}
              {batchProgress && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#17122b] to-[#121629] border border-[#ff35bb]/40 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs text-white font-bold">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#ff35bb]" />
                      <span>{batchProgress.message}</span>
                    </span>
                    <span className="text-[#00d2ff] font-mono">
                      {batchProgress.percent ?? Math.round((batchProgress.completed / Math.max(1, batchProgress.total)) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-[#0b0e18] rounded-full h-2 overflow-hidden border border-[#252a3d]">
                    <div
                      className="bg-gradient-to-r from-[#ff35bb] via-[#8b4dff] to-[#00d2ff] h-full transition-all duration-300"
                      style={{
                        width: `${batchProgress.percent ?? Math.round((batchProgress.completed / Math.max(1, batchProgress.total)) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-[#9da4b8] text-right">
                    {batchProgress.completed} of {batchProgress.total} slots saved to IndexedDB & Firestore
                  </p>
                </div>
              )}

              {/* Batch Publish CTA Button */}
              <button
                type="button"
                onClick={handleBatchSubmit}
                disabled={isProcessing || batchQueue.length === 0}
                className={`w-full py-4 rounded-xl text-white font-display font-bold text-sm tracking-wide shadow-xl hover:opacity-95 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 ${
                  uploadTarget === 'private'
                    ? 'bg-gradient-to-r from-rose-500 via-pink-500 to-orange-500 shadow-rose-500/25'
                    : 'bg-gradient-to-r from-[#ff35bb] via-[#a855f7] to-[#8b4dff] shadow-[#ff35bb]/25'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    <span>
                      {uploadTarget === 'private'
                        ? `Private VIP গ্যালারিতে সেভ হচ্ছে (${batchVideoCount}টি ভিডিও)...`
                        : `একসাথে স্লটগুলোতে সেভ হচ্ছে (${batchQueue.length} items)...`}
                    </span>
                  </>
                ) : (
                  <>
                    {uploadTarget === 'private' ? (
                      <Flame className="w-5 h-5 text-white" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-white" />
                    )}
                    <span>
                      {uploadTarget === 'private'
                        ? batchVideoCount > 0
                          ? `সবগুলো (${batchVideoCount}টি ভিডিও) Private VIP গ্যালারিতে পাবলিশ করুন`
                          : 'প্রথমে Private গ্যালারির জন্য ভিডিও সিলেক্ট করুন'
                        : batchQueue.length > 0
                          ? `একসাথে সবগুলো (${batchQueue.length}টি) স্লটে পাবলিশ করুন`
                          : 'প্রথমে ফাইল বা লিংক সিলেক্ট করুন'}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* SINGLE SLOT UPLOAD MODE (Fully preserved) */}
          {/* ========================================================= */}
          {uploadMode === 'single' && (
            <div>
              {/* Media Selector Tabs (Requirement 1) */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#0b0e18] border border-[#252a3d] rounded-xl">
                <button
                  type="button"
                  onClick={() => handleSwitchTab('photo')}
                  disabled={isProcessing}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                    mediaType === 'photo'
                      ? 'bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white shadow-md shadow-[#ff35bb]/20'
                      : 'text-[#9da4b8] hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Photo Slot ({Math.max(0, 500 - currentPhotoCount)} left)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchTab('video')}
                  disabled={isProcessing}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                    mediaType === 'video'
                      ? 'bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white shadow-md shadow-[#8b4dff]/20'
                      : 'text-[#9da4b8] hover:text-white'
                  }`}
                >
                  <Film className="w-4 h-4" />
                  <span>Video Reel ({Math.max(0, 500 - currentVideoCount)} left)</span>
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
                {/* File Picker or URL */}
                <div>
                  <label className="block text-xs font-bold text-[#d5cce7] mb-1.5 flex items-center justify-between">
                    <span>ডিভাইস থেকে ফাইল নির্বাচন করুন বা লিংক দিন:</span>
                    <span className="text-[10px] text-amber-300 font-normal">
                      {mediaType === 'photo' ? 'PNG, JPG, WEBP' : 'MP4, WEBM, YouTube'}
                    </span>
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                      className="flex-1 py-3 px-4 border border-dashed border-[#ff35bb]/60 rounded-xl bg-[#161a2b]/70 hover:bg-[#161a2b] text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 group disabled:opacity-50"
                    >
                      <Upload className="w-5 h-5 text-[#ff35bb] group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-white">
                        {selectedPhotoFile || selectedVideoFile || previewData 
                          ? `Change selected ${mediaType}` 
                          : `ডিভাইস থেকে ${mediaType === 'photo' ? 'ছবি (Photo)' : 'ভিডিও (Video)'} নির্বাচন করুন`}
                      </span>
                      <span className="text-[10px] text-amber-300 font-semibold">
                        💡 সবগুলো একসাথে নিতে ফোল্ডারে Ctrl + A চেপে All Select করুন
                      </span>
                    </button>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={mediaType === 'photo' ? 'image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.jfif,.220' : 'video/*,.mp4,.webm,.mov,.m4v'}
                      onChange={handleFileChange}
                      disabled={isProcessing}
                      className="hidden"
                    />
                  </div>

                  {/* Visual Live Preview Card (Requirement 2) */}
                  {previewData && (
                    <div className="mt-3 p-3 rounded-2xl bg-[#0b0e18] border border-[#ff35bb]/40 shadow-lg relative overflow-hidden animate-in fade-in">
                      <div className="flex items-start gap-3">
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-black border border-[#252a3d] shrink-0">
                          <img
                            src={previewData}
                            alt="Preview"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          {mediaType === 'video' && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Play className="w-5 h-5 text-white fill-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#ff35bb]/20 text-[#ff8ce4] font-bold border border-[#ff35bb]/30">
                              {mediaType === 'photo' ? 'Photo Preview' : 'Video Reel'}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Ready</span>
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-white truncate">
                            {title.trim() || (selectedPhotoFile?.name || selectedVideoFile?.name || 'New Media')}
                          </h4>

                          <p className="text-[11px] text-[#9da4b8] mt-0.5">
                            {mediaType === 'photo' ? (
                              <span>Slot #{nextSlotNumber} · {category}</span>
                            ) : (
                              <span>Duration: {duration} · Slot #{nextSlotNumber}</span>
                            )}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleClearPreview}
                          disabled={isProcessing}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                          title="Remove selected media"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Video playback test preview if local blob */}
                      {videoBlobUrl && mediaType === 'video' && (
                        <div className="mt-2.5 pt-2 border-t border-[#252a3d]">
                          <video
                            src={videoBlobUrl}
                            controls
                            playsInline
                            className="w-full max-h-40 rounded-xl bg-black"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compression or Optimization Notice */}
                  {compressionNotice && (
                    <div className="mt-2 p-2.5 bg-emerald-950/40 rounded-xl border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-400 animate-in fade-in">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-medium text-[11px]">{compressionNotice}</span>
                    </div>
                  )}

                  {/* Error Message Banner */}
                  {errorMessage && (
                    <div className="mt-2 p-2.5 bg-red-950/40 rounded-xl border border-red-500/40 flex items-start gap-2 text-xs text-red-300 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{errorMessage}</span>
                    </div>
                  )}

                  {/* Web URL input (Alternative to device file) */}
                  <div className="mt-3 text-center text-[11px] text-[#9da4b8] flex items-center justify-center gap-2">
                    <span className="h-px bg-[#252a3d] flex-1" />
                    <span>অথবা ওয়েব লিংক পেস্ট করুন</span>
                    <span className="h-px bg-[#252a3d] flex-1" />
                  </div>

                  <div className="relative mt-1.5">
                    <div className="absolute left-3 top-2.5 text-[#9da4b8]">
                      <LinkIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => handleUrlInputChange(e.target.value)}
                      disabled={isProcessing}
                      placeholder={
                        mediaType === 'photo'
                          ? 'https://example.com/photo.jpg (ছবির সরাসরি লিংক)'
                          : 'YouTube / Shorts / MP4 URL (যেমন: https://youtu.be/...)'
                      }
                      className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl pl-9 pr-24 py-2 text-xs text-white placeholder-[#9da4b8]/50 focus:outline-none disabled:opacity-50"
                    />
                    {mediaType === 'video' && (
                      <div className="absolute right-2.5 top-2 flex items-center gap-1 text-[10px] text-red-400 font-mono">
                        <Youtube className="w-3.5 h-3.5" />
                        <span>YouTube OK</span>
                      </div>
                    )}
                  </div>

                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-[#d5cce7] mb-1">
                    শিরোনাম (Title) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isProcessing}
                    placeholder="যেমন: Sensual Midnight Glow"
                    className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2 text-xs text-white placeholder-[#9da4b8]/50 focus:outline-none disabled:opacity-50"
                  />
                </div>

                {/* Category & Duration/Tags */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-[#d5cce7] mb-1">ক্যাটাগরি (Category)</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as CategoryType)}
                      disabled={isProcessing}
                      className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-50"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat === 'Sexy' ? '🔞 Sexy (Blur & Ad Unlock)' : cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {mediaType === 'video' ? (
                    <div>
                      <label className="block text-xs font-bold text-[#d5cce7] mb-1">ভিডিও সময়কাল (Duration)</label>
                      <input
                        type="text"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        disabled={isProcessing}
                        placeholder="যেমন: 0:45"
                        className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-[#d5cce7] mb-1">ট্যাগ (Tags)</label>
                      <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        disabled={isProcessing}
                        placeholder="কমা দিয়ে লিখুন"
                        className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  )}

                  {category === 'Sexy' && (
                    <div className="col-span-2 p-2.5 rounded-xl bg-[#ff35bb]/15 border border-[#ff35bb]/40 text-[11px] text-[#ff80d5] flex items-start gap-2 animate-in fade-in">
                      <span className="font-bold text-base leading-none">🔞</span>
                      <div className="space-y-0.5">
                        <strong className="text-white block font-bold">Sexy ক্যাটাগরি স্বয়ংক্রিয় ব্লার নীতি:</strong>
                        <p className="text-[#ffb3e6] leading-tight">
                          এই কন্টেন্টটি গ্যালারিতে সম্পূর্ণ ব্লার (Blur) থাকবে। দর্শকরা ৩০ সেকেন্ড রিওয়ার্ডেড বিজ্ঞাপন দেখে আনলক করে দেখতে পারবে।
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={isProcessing || isValidatingUrl}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] text-white font-display font-bold text-sm tracking-wide shadow-lg shadow-[#ff35bb]/25 hover:opacity-95 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {isProcessing || isValidatingUrl ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>
                        {isValidatingUrl ? 'লিংক যাচাই করা হচ্ছে...' : `সংরক্ষণ ও প্রসেসিং হচ্ছে (Slot #${nextSlotNumber})...`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-white" />
                      <span>
                        {mediaType === 'photo' 
                          ? `গ্যালারি স্লট #${nextSlotNumber} এ পাবলিশ করুন` 
                          : `ভিডিও স্লট #${nextSlotNumber} এ পাবলিশ করুন`}
                      </span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* Interactive Video Play & Preview Player Modal (Before Upload) */}
      {previewVideoItem && (
        <div className="fixed inset-0 z-[500] bg-black/92 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-[#0f1322] border border-[#ff35bb]/50 rounded-3xl overflow-hidden shadow-2xl flex flex-col my-auto animate-in zoom-in-95">
            {/* Top Bar */}
            <div className="flex items-center justify-between p-3.5 bg-[#0a0d18] border-b border-[#252a3d]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff35bb] to-[#8b4dff] flex items-center justify-center text-white shadow-md">
                  <Play className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white truncate max-w-[220px] sm:max-w-xs">
                    {previewVideoItem.title}
                  </h4>
                  <p className="text-[11px] text-[#00d2ff]">
                    ভিডিও প্লেয়ার প্রিভিউ · আপলোডের আগে চালিয়ে দেখুন
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewVideoItem(null)}
                className="w-8 h-8 rounded-full bg-[#1b2138] hover:bg-[#252c48] text-white flex items-center justify-center transition-colors"
                title="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player Frame */}
            <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
              <video
                key={previewVideoItem.id}
                src={previewVideoItem.sourceUrl || previewVideoItem.thumbnailUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            {/* Quick Edit & Control Panel */}
            <div className="p-4 bg-[#111524] space-y-3 border-t border-[#252a3d]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] text-[#9da4b8] mb-1 font-semibold">ভিডিওর নাম (Title):</label>
                  <input
                    type="text"
                    value={previewVideoItem.title}
                    onChange={(e) => {
                      const updatedTitle = e.target.value;
                      setPreviewVideoItem({ ...previewVideoItem, title: updatedTitle });
                      setBatchQueue((prev) =>
                        prev.map((it) => (it.id === previewVideoItem.id ? { ...it, title: updatedTitle } : it))
                      );
                    }}
                    className="w-full bg-[#0b0e18] border border-[#252a3d] focus:border-[#ff35bb] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#9da4b8] mb-1 font-semibold">ক্যাটাগরি:</label>
                  <select
                    value={previewVideoItem.category}
                    onChange={(e) => {
                      const updatedCat = e.target.value as CategoryType;
                      setPreviewVideoItem({ ...previewVideoItem, category: updatedCat });
                      setBatchQueue((prev) =>
                        prev.map((it) => (it.id === previewVideoItem.id ? { ...it, category: updatedCat } : it))
                      );
                    }}
                    className="w-full bg-[#0b0e18] border border-[#252a3d] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#252a3d]/70">
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playPop();
                    setBatchQueue((prev) => prev.filter((it) => it.id !== previewVideoItem.id));
                    setPreviewVideoItem(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>কিউ থেকে মুছুন</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={async () => {
                      try {
                        setIsProcessing(true);
                        soundFX.playSuccess();
                        const item = previewVideoItem;
                        const nextSlot = baseVideoSlot;
                        const videoId = item.id.startsWith('video-') ? item.id : `video-${Date.now()}`;
                        const rawFileOrBlob = item.blob || item.file;
                        let finalVideoUrl = item.sourceUrl && !item.sourceUrl.startsWith('blob:') ? item.sourceUrl : '';
                        let isCloudChunked = false;
                        let cloudChunkCount: number | undefined;
                        let fileSizeBytes: number | undefined;
                        if (rawFileOrBlob) {
                          if (rawFileOrBlob.size <= MAX_INLINE_VIDEO_BYTES) {
                            finalVideoUrl = await blobToDataUrl(rawFileOrBlob);
                          } else {
                            const cloudRes = await uploadVideoToFirestoreChunks(videoId, rawFileOrBlob, item.title);
                            finalVideoUrl = cloudRes.streamUrl;
                            isCloudChunked = true;
                            cloudChunkCount = cloudRes.totalChunks;
                            fileSizeBytes = cloudRes.sizeBytes;
                          }
                        }
                        const singleVideo: VideoItem = {
                          id: videoId,
                          slotNumber: nextSlot,
                          title: item.title.trim() || `Video Reel Slot #${nextSlot}`,
                          category: item.category || 'Cinematic',
                          videoUrl: finalVideoUrl,
                          thumbnailUrl: item.thumbnailUrl,
                          fallbackGradient: 'linear-gradient(135deg, #8b4dff, #00d2ff)',
                          duration: item.duration || '0:30',
                          views: 1,
                          likes: generateInitialLikes(nextSlot),
                          isLiked: false,
                          author: userProfile.name || 'Suzika Creator',
                          tags: item.tags ? item.tags.split(',').map((t) => t.trim()).filter(Boolean) : ['Reels'],
                          createdAt: 'Just now',
                          createdAtMs: Date.now(),
                          isLocalIndexedDB: false,
                          isCloudChunked,
                          ...(cloudChunkCount !== undefined ? { cloudChunkCount } : {}),
                          ...(fileSizeBytes !== undefined ? { fileSizeBytes } : {}),
                          videoType: 'direct',
                        };
                        await onAddVideo(singleVideo, rawFileOrBlob);
                        setBatchQueue((prev) => prev.filter((it) => it.id !== item.id));
                        setPreviewVideoItem(null);
                        if (onNavigateTab) onNavigateTab('videos');
                      } catch (err: any) {
                        setErrorMessage(err?.message || 'ভিডিও আপলোড করতে সমস্যা হয়েছে।');
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#ff35bb] to-[#8b4dff] hover:opacity-95 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>এই ১টি ভিডিও এখনই আপলোড করুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playSuccess();
                      setPreviewVideoItem(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:opacity-95 text-black font-extrabold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>✓ ভিডিও ঠিক আছে (Done)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
