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
  const [srcId, setSrcId] = useState<number>(sourceId ?? 9);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useUploadVariantFile();

  const handleFile = (f: File) => {
    setFile(f);
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
      <div className="bg-[#151518] border border-[#232328] rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232328]">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#A78BFA]/12">
              <Dna size={14} style={{ color: "#A78BFA" }} />
            </div>
            <h2 className="text-sm font-semibold text-[#F0EDE8]">Upload Variant File</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5A5650] hover:text-[#8A857D] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 cursor-pointer transition-colors ${
              dragOver
                ? "border-[#2DD4BF] bg-[#2DD4BF]/10"
                : "border-[#2A2A30] hover:border-[#3A3A42] bg-[#0E0E11]"
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
              <div className="flex items-center gap-2 text-[#2DD4BF]">
                <CheckCircle2 size={16} />
                <span className="text-sm font-medium text-[#F0EDE8]">{file.name}</span>
                <span className="text-xs text-[#5A5650]">({(file.size / 1024).toFixed(0)} KB)</span>
              </div>
            ) : (
              <>
                <Upload size={24} className="text-[#5A5650] mb-2" />
                <p className="text-sm text-[#8A857D]">Drop file here or click to browse</p>
                <p className="text-xs text-[#5A5650] mt-1">.vcf, .maf, .json</p>
              </>
            )}
          </div>

          {/* Format selector */}
          <div>
            <label className="block text-xs text-[#8A857D] mb-1.5">File Format</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FORMAT_INFO) as FileFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-colors ${
                    format === f
                      ? "border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF]"
                      : "border-[#232328] hover:border-[#2A2A30] text-[#8A857D]"
                  }`}
                >
                  <div className={`font-medium ${format === f ? "text-[#F0EDE8]" : "text-[#C5C0B8]"}`}>
                    {FORMAT_INFO[f].label}
                  </div>
                  <div className="text-[#5A5650] mt-0.5">{FORMAT_INFO[f].ext}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-[#5A5650] mt-1.5">{FORMAT_INFO[format].desc}</p>
          </div>

          {/* Genome build + sample ID */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#8A857D] mb-1.5">Genome Build</label>
              <select
                value={build}
                onChange={(e) => setBuild(e.target.value as GenomeBuild)}
                className="w-full rounded-lg bg-[#0E0E11] border border-[#232328] px-3 py-2 text-sm text-[#F0EDE8] focus:outline-none focus:border-[#2DD4BF] transition-colors"
              >
                <option value="GRCh38">GRCh38 / hg38</option>
                <option value="GRCh37">GRCh37 / hg19</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#8A857D] mb-1.5">Sample ID (optional)</label>
              <input
                type="text"
                value={sampleId}
                onChange={(e) => setSampleId(e.target.value)}
                placeholder="SAMPLE_001"
                className="w-full rounded-lg bg-[#0E0E11] border border-[#232328] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#2DD4BF] transition-colors"
              />
            </div>
          </div>

          {/* Error */}
          {upload.isError && (
            <div className="flex items-center gap-2 rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/10 p-3 text-[#E85A6B] text-xs">
              <AlertCircle size={14} />
              <span>Upload failed. Please check the file format and try again.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[#232328]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#5A5650] hover:text-[#8A857D] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!file || upload.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
