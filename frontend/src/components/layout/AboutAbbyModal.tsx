import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";

interface AboutAbbyModalProps {
  open: boolean;
  onClose: () => void;
}

const IMAGES = [
  { src: "/abigail-geisinger.avif", alt: "Abigail A. Geisinger (1827–1921)" },
  { src: "/Abby-AI.png", alt: "Abby — Parthenon AI Assistant" },
];

const FADE_DURATION = 6000; // ms per image

export function AboutAbbyModal({ open, onClose }: AboutAbbyModalProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setActiveIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % IMAGES.length);
    }, FADE_DURATION);
    return () => clearInterval(interval);
  }, [open]);

  const caption = activeIndex === 0
    ? "Abigail A. Geisinger, 1827–1921"
    : "Abby — AI Research Assistant";

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div style={{ padding: "8px 4px" }}>
        {/* Hero with crossfade */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              position: "relative",
              width: 200,
              height: 200,
              margin: "0 auto 16px",
              borderRadius: "50%",
              border: "3px solid var(--gold, #C9A227)",
              boxShadow: "0 8px 32px rgba(201, 162, 39, 0.2)",
              overflow: "hidden",
            }}
          >
            {IMAGES.map((img, i) => (
              <img
                key={img.src}
                src={img.src}
                alt={img.alt}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: activeIndex === i ? 1 : 0,
                  transition: "opacity 2s ease-in-out",
                }}
              />
            ))}
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted, #6A655D)",
              fontStyle: "italic",
              margin: "0 0 12px",
              minHeight: 20,
              transition: "opacity 1s ease-in-out",
            }}
          >
            {caption}
          </p>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--gold, #C9A227)",
              margin: "0 0 4px",
              letterSpacing: "-0.5px",
            }}
          >
            About Abby
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted, #6A655D)",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            Parthenon's AI Research Assistant
          </p>
        </div>

        {/* Dedication */}
        <div
          style={{
            background: "var(--surface-raised, #1C1C24)",
            borderRadius: 12,
            padding: "24px 28px",
            marginBottom: 24,
            borderLeft: "4px solid var(--gold, #C9A227)",
          }}
        >
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-primary, #F0EDE8)",
              margin: "0 0 16px",
            }}
          >
            In Memory of Abigail Geisinger
          </h3>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            Abby is named in honor of{" "}
            <strong style={{ color: "var(--text-primary, #F0EDE8)" }}>
              Abigail A. Geisinger
            </strong>{" "}
            (1827–1921), the pioneering philanthropist who founded what would
            become one of America's most innovative healthcare systems.
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            At the age of 85, widowed and childless, Abigail looked at her rural
            community of Danville, Pennsylvania, and saw a problem that no one
            else was solving: there was no hospital. People who fell ill had to be
            transported by carriage — and later by her own personal Hupmobile — to
            the nearest facility in Sunbury. She decided she was going to fix
            that.
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            In 1912, she gathered a group of people together and set her vision
            into motion. She called upon the Mayo brothers themselves to recommend
            a physician worthy of leading her hospital. They sent her Dr. Harold
            Foss, who was practicing medicine on the frozen banks of the Kiwalik
            River in Candle, Alaska. She convinced him to come to Pennsylvania.
            The cornerstone was laid in 1913. When the George F. Geisinger
            Memorial Hospital opened on September 12, 1915, a typhoid epidemic
            had swept through Danville just two weeks earlier — and her hospital
            was already saving lives.
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            Her motto during construction was unwavering:
          </p>
          <blockquote
            style={{
              borderLeft: "3px solid var(--gold, #C9A227)",
              paddingLeft: 20,
              margin: "16px 0",
              fontStyle: "italic",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--gold, #C9A227)",
              lineHeight: 1.5,
            }}
          >
            "Make my hospital right. Make it the best."
          </blockquote>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            She was not merely a benefactor who wrote checks. She visited patients
            and brought flowers from her own garden. At Christmas, she distributed
            baskets of fruit throughout the community. During World War I, she
            volunteered to care for wounded soldiers and personally contacted
            national leaders to offer her hospital's services. Photographs from
            the cornerstone ceremony show her with her head thrown back, laughing
            — a woman of warmth, humor, and iron determination.
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            When Abigail Geisinger died on July 8, 1921, at the age of 94, she
            left over one million dollars to ensure her hospital would endure. She
            is buried in a cemetery overlooking the institution she built — a
            quiet sentinel watching over her life's greatest achievement as it
            grew from 44 beds and 13 acres into a health system spanning ten
            hospitals, training generations of physicians, and touching millions
            of lives.
          </p>
        </div>

        {/* Why Abby */}
        <div
          style={{
            background: "var(--surface-raised, #1C1C24)",
            borderRadius: 12,
            padding: "24px 28px",
            marginBottom: 24,
            borderLeft: "4px solid var(--teal, #2DD4BF)",
          }}
        >
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-primary, #F0EDE8)",
              margin: "0 0 16px",
            }}
          >
            Why We Named Her Abby
          </h3>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            Abigail Geisinger saw that healthcare was too fragmented, too
            inaccessible, and too difficult for the people who needed it most. She
            did not accept that as the way things had to be. She built something
            better.
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            Parthenon exists for the same reason. The OHDSI ecosystem — Atlas,
            WebAPI, Achilles, and a dozen other tools — is powerful but
            fragmented. Researchers spend more time wrestling with tooling than
            answering clinical questions. Parthenon brings it all under one roof,
            just as Abigail brought modern medicine to a community that had none.
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: 0,
            }}
          >
            Abby, our AI assistant, carries her namesake's spirit: she helps
            researchers describe cohorts in plain English, maps concepts across
            vocabularies, and works to make the complex accessible. She is our
            small tribute to a woman who looked at an impossible problem and said,
            simply, <em>"I'm going to fix that."</em>
          </p>
        </div>

        {/* Footer attribution */}
        <p
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "var(--text-muted, #6A655D)",
            margin: "16px 0 0",
            fontStyle: "italic",
          }}
        >
          Dedicated with admiration to the memory of Abigail A. Geisinger
          (1827–1921)
          <br />
          Founder of Geisinger Medical Center — Danville, Pennsylvania
        </p>
      </div>
    </Modal>
  );
}
