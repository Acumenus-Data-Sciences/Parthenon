import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/Modal";

interface AboutAbbyModalProps {
  open: boolean;
  onClose: () => void;
}

const FADE_DURATION = 6000; // ms per image

export function AboutAbbyModal({ open, onClose }: AboutAbbyModalProps) {
  const { t } = useTranslation("layout");
  const [activeIndex, setActiveIndex] = useState(0);
  const images = [
    {
      src: "/abigail-geisinger.avif",
      alt: t("abby.about.images.abigailAlt"),
    },
    {
      src: "/Abby-AI.png",
      alt: t("abby.about.images.abbyAlt"),
    },
  ];

  useEffect(() => {
    if (!open) {
      setActiveIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length);
    }, FADE_DURATION);
    return () => clearInterval(interval);
  }, [images.length, open]);

  const caption = activeIndex === 0
    ? t("abby.about.images.abigailCaption")
    : t("abby.about.images.abbyCaption");

  return (
    <Modal open={open} onClose={onClose} size="lg" title={t("abby.about.title")}>
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
            {images.map((img, i) => (
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
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted, #6A655D)",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            {t("abby.about.subtitle")}
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
            {t("abby.about.dedication.title")}
          </h3>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            {t("abby.about.dedication.namedPrefix")}{" "}
            <strong style={{ color: "var(--text-primary, #F0EDE8)" }}>
              {t("abby.about.dedication.namedName")}
            </strong>{" "}
            {t("abby.about.dedication.namedSuffix")}
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            {t("abby.about.dedication.age85")}
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            {t("abby.about.dedication.founding")}
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            {t("abby.about.dedication.mottoIntro")}
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
            {t("abby.about.dedication.motto")}
          </blockquote>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            {t("abby.about.dedication.service")}
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            {t("abby.about.dedication.legacy")}
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
            {t("abby.about.why.title")}
          </h3>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            {t("abby.about.why.problem")}
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: "0 0 16px",
            }}
          >
            {t("abby.about.why.parthenon")}
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--text-secondary, #A09A90)",
              margin: 0,
            }}
          >
            {t("abby.about.why.abbyPrefix")}{" "}
            <em>{t("abby.about.why.abbyQuote")}</em>
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
          {t("abby.about.footer.dedication")}
          <br />
          {t("abby.about.footer.founder")}
        </p>
      </div>
    </Modal>
  );
}
