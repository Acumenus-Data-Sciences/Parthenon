import { useState, useRef } from "react";
import { X, Upload, AlertCircle, CheckCircle2, Loader2, Dna } from "lucide-react";
import { useUploadVariantFile } from "../hooks/useGenomics";
import type { FileFormat, GenomeBuild } from "../types";

const FORMAT_INFO: Record<FileFormat, { label: string; ext: string; desc: string }> = {
  vcf: {
    label: "VCF",
    ext: ".vcf, .vcf.gz",
    desc: "Variant Call Format — standard variant output from GATK, DeepVariant, FreeBayes",
  },
  maf: {
    label: "MAF",
    ext: ".maf, .maf.gz",
    desc: "Mutation Annotation Format — output from TCGA pipelines and tumor-only callers",
  },
  cbio_maf: {
    label: "cBioPortal MAF",
    ext: ".txt, .maf",
    desc: "cBioPortal tab-delimited mutation data file",
  },
  fhir_genomics: {
    label: "FHIR Genomics",
    ext: ".json",
    desc: "FHIR R4 DiagnosticReport / Observation genomics bundle",
  },
};

interface Props {
  onClose: () => void;
  sourceId?: number;
}

export function UploadDialog({ onClose, sourceId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<FileFormat>("vcf");
  const [build, setBuild] = useState<GenomeBuild>("GRCh38");
  const [sampleId, setSampleId] = useState("");
  const [srcId, setSrcId] = useState<number>(sourceId ?? 9); // default to first source
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useUploadVariantFile();

  const handleFile = (f: File) => {
    setFile(f);
    // Auto-detect format from extension
    const name = f.name.toLowerCase();
    if (name.endsWith(".maf") || name.endsWith(".maf.gz")) {
      setFormat("maf");
    } else if (name.endsWith(".json")) {
      setFormat("fhir_genomics");
    } else {
      setFormat("vcf");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    await upload.mutateAsync({
      source_id: srcId,
      file,
      file_format: format,
      genome_build: build,
      sample_id: sampleId || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f0f23] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Dna size={18} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Upload Variant File</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors ${
              dragOver ? "border-purple-500 bg-purple-900/20" : "border-white/20 hover:border-white/40"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".vcf,.vcf.gz,.maf,.maf.gz,.txt,.json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {file ? (
              <div className="flex items-center gap-2 text-green-300">
                <CheckCircle2 size={18} />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(0)} KB)</span>
              </div>
            ) : (
              <>
                <Upload size={28} className="text-gray-500 mb-2" />
                <p className="text-sm text-gray-400">Drop file here or click to browse</p>
                <p className="text-xs text-gray-600 mt-1">.vcf, .maf, .json</p>
              </>
            )}
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">File Format</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FORMAT_INFO) as FileFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-colors ${
                    format === f
                      ? "border-purple-500 bg-purple-900/30 text-purple-200"
                      : "border-white/10 hover:border-white/20 text-gray-400"
                  }`}
                >
                  <div className="font-medium text-white/80">{FORMAT_INFO[f].label}</div>
                  <div className="text-gray-500">{FORMAT_INFO[f].ext}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-1.5">{FORMAT_INFO[format].desc}</p>
          </div>

          {/* Genome build */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Genome Build</label>
              <select
                value={build}
                onChange={(e) => setBuild(e.target.value as GenomeBuild)}
                className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                <option value="GRCh38">GRCh38 / hg38</option>
                <option value="GRCh37">GRCh37 / hg19</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Sample ID (optional)</label>
              <input
                type="text"
                value={sampleId}
                onChange={(e) => setSampleId(e.target.value)}
                placeholder="SAMPLE_001"
                className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Error */}
          {upload.isError && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 rounded-lg p-3">
              <AlertCircle size={14} />
              <span>Upload failed. Please check the file format and try again.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || upload.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {upload.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Uploading & parsing...
              </>
            ) : (
              <>
                <Upload size={14} />
                Upload & Parse
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
