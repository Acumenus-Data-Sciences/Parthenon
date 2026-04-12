import { useRef, useState, useEffect } from "react";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadAvatar, useDeleteAvatar } from "../hooks/useProfile";
import { useAuthStore } from "@/stores/authStore";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED = ".jpeg,.jpg,.png,.webp";

export function AvatarUpload() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const uploadMutation = useUploadAvatar();
  const deleteMutation = useDeleteAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  // Build display URL: local blob preview > server avatar > nothing
  const serverAvatarUrl = user?.avatar
    ? `/storage/${user.avatar}`
    : null;
  const displayUrl = localPreview ?? serverAvatarUrl;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      setError("File must be under 5MB");
      return;
    }

    // Instant client-side preview
    const blobUrl = URL.createObjectURL(file);
    setLocalPreview(blobUrl);

    uploadMutation.mutate(file, {
      onSuccess: (response) => {
        // Update the auth store — persisted to localStorage
        if (user) {
          updateUser({ ...user, avatar: response.avatar });
        }
        // Preload the server image before clearing the blob preview
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(blobUrl);
          setLocalPreview(null);
        };
        img.onerror = () => {
          // Server image failed — keep blob as permanent preview
        };
        img.src = `/storage/${response.avatar}`;
      },
      onError: () => {
        setError("Upload failed. Please try again.");
        // Revert preview
        URL.revokeObjectURL(blobUrl);
        setLocalPreview(null);
      },
    });

    e.target.value = "";
  };

  const handleDelete = () => {
    setError(null);
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        if (user) {
          updateUser({ ...user, avatar: null });
        }
      },
      onError: () => setError("Failed to remove avatar."),
    });
  };

  const isLoading = uploadMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        <div
          className={cn(
            "w-[120px] h-[120px] rounded-full border-2 border-[#232328] overflow-hidden",
            "flex items-center justify-center bg-[#1A1A1F] text-[#5A5650]",
          )}
        >
          {displayUrl ? (
            <div className="relative w-full h-full">
              <img
                src={displayUrl}
                alt={user?.name ?? "Avatar"}
                className="w-full h-full object-cover"
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <Loader2 size={24} className="animate-spin text-text-primary" />
                </div>
              )}
            </div>
          ) : (
            <span className="text-3xl font-bold">
              {user?.name?.charAt(0).toUpperCase() ?? "?"}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            "border border-[#232328] bg-[#151518] text-[#C5C0B8] hover:bg-[#1A1A1F] disabled:opacity-50",
          )}
        >
          <Camera size={14} />
          Upload Photo
        </button>
        {displayUrl && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isLoading}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              "text-[#E85A6B] hover:bg-[#E85A6B]/10 disabled:opacity-50",
            )}
          >
            <Trash2 size={14} />
            Remove
          </button>
        )}
        {error && <p className="text-xs text-[#E85A6B]">{error}</p>}
        <p className="text-xs text-[#5A5650]">JPEG, PNG, or WebP. Max 5MB.</p>
      </div>
    </div>
  );
}
