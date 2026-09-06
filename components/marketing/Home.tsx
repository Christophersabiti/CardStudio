"use client";
import Link from "next/link";
import { useState } from "react";
const steps = [
  {
    name: "Create",
    title: "A little you. A lot of possibility.",
    text: "Add the details that matter. Your photo, your business, your next big thing. See it all come together as you type.",
  },
  {
    name: "Share",
    title: "Less typing. More talking.",
    text: "Share your profile link or let someone scan your QR. Your introduction is ready whenever the conversation starts.",
  },
  {
    name: "Update",
    title: "New role? Same connection.",
    text: "Keep your profile link and publish fresh details whenever things change. Your next scan opens the latest version.",
  },
];
export default function Home() {
  const [step, setStep] = useState(0);
  return (
    <main id="main-content">
      <section className="mk-hero">
        <div className="mk-hero-copy">
          <p className="mk-eyebrow">
            <span className="mk-dot" /> Small card. Endless possibilities.
          </p>
          <h1>
            Make your
            <br />
            next <em>hello</em>
            <br />
            go further.
          </h1>
          <p className="mk-lead">
            A digital business card for the way you connect.
            <br className="mk-desktop" /> Create it. Share it. Make it
            unmistakably you.
          </p>
          <div className="mk-cta-row">
            <Link className="mk-button" href="/studio">
              Create your card <span aria-hidden>↗</span>
            </Link>
            <Link className="mk-text-link" href="/explore/teams">
              Explore for teams <span aria-hidden>→</span>
            </Link>
          </div>
          <p className="mk-fine">
            Start with a private draft. Publish when you’re ready.
          </p>
        </div>
        <div className="mk-hero-art" aria-label="Example digital business card">
          <span className="mk-art-orbit" />
          <span className="mk-art-star" aria-hidden>
            ✳
          </span>
          <div className="mk-float-note">
            <span className="mk-note-icon">↗</span> A better first impression.
          </div>
          <div className="mk-phone">
            <div className="mk-phone-top">
              <span>9:41</span>
              <span>••• ▰</span>
            </div>
            <div className="mk-cover">
              <div className="mk-cover-mark">
                hello<span>↗</span>
              </div>
            </div>
            <div className="mk-avatar">AN</div>
            <div className="mk-phone-body">
              <p className="mk-eyebrow">Meet your next collaborator</p>
              <h2>Amina Namusoke</h2>
              <p>Brand strategist · Kampala</p>
              <div className="mk-demo-tags">
                <span>Ideas</span>
                <span>Identity</span>
                <span>Impact</span>
              </div>
              <div className="mk-demo-save">
                Save contact <span>+</span>
              </div>
              <div className="mk-demo-row">
                amina@example.com <span>↗</span>
              </div>
              <div className="mk-demo-row">
                Let’s build something good. <span>↗</span>
              </div>
              <div className="mk-mini-brand">made with card studio</div>
            </div>
          </div>
          <div className="mk-floating-card">
            <span className="mk-mini-avatar">AN</span>
            <div>
              <strong>Your details. One link.</strong>
              <small>Ready for your next introduction</small>
            </div>
            <span>✓</span>
          </div>
        </div>
      </section>
      <section className="mk-ribbon" aria-label="Ways to connect">
        <span>Built for real conversations</span>
        <strong>Meetings</strong>
        <i>✳</i>
        <strong>Events</strong>
        <i>✳</i>
        <strong>Teams</strong>
        <i>✳</i>
        <strong>Everyday hellos</strong>
      </section>
      <section className="mk-section mk-intro">
        <p className="mk-eyebrow">A simpler way to stay connected</p>
        <h2>
          Leave an impression.
          <br />
          <span>Not a stack of paper.</span>
        </h2>
        <div className="mk-three">
          <article>
            <span className="mk-number">01</span>
            <h3>
              All your details.
              <br />
              One beautiful place.
            </h3>
            <p>
              Bring your contact details, social profiles and business identity
              together.
            </p>
          </article>
          <article>
            <span className="mk-number">02</span>
            <h3>
              Made to share.
              <br />
              Ready in a moment.
            </h3>
            <p>
              A link or QR code is all it takes. Recipients open your profile in
              their browser.
            </p>
          </article>
          <article>
            <span className="mk-number">03</span>
            <h3>
              Life changes.
              <br />
              Your card can too.
            </h3>
            <p>
              Save edits privately, then publish the version you want the world
              to see.
            </p>
          </article>
        </div>
      </section>
      <section className="mk-section mk-how" id="how-it-works">
        <div>
          <p className="mk-eyebrow">From hello to what’s next</p>
          <h2>
            Three steps.
            <br />A better connection.
          </h2>
          <div className="mk-tabs" role="tablist" aria-label="How it works">
            {steps.map((s, i) => (
              <button
                id={`step-${i}`}
                role="tab"
                aria-selected={step === i}
                aria-controls="step-panel"
                tabIndex={step === i ? 0 : -1}
                key={s.name}
                onClick={() => setStep(i)}
                onKeyDown={(e) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  ) {
                    e.preventDefault();
                    const next =
                      e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? 2
                          : (i + (e.key === "ArrowRight" ? 1 : 2)) % 3;
                    setStep(next);
                    document.getElementById(`step-${next}`)?.focus();
                  }
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div role="tabpanel" id="step-panel" aria-labelledby={`step-${step}`}>
            <h3>{steps[step].title}</h3>
            <p>{steps[step].text}</p>
          </div>
          <Link href="/studio" className="mk-text-link">
            Make your first card ↗
          </Link>
        </div>
        <div className="mk-workspace">
          <div className="mk-workspace-bar">
            <span>● ● ●</span>
            <span>your next introduction</span>
          </div>
          <div className="mk-workspace-content">
            <span className="mk-eyebrow">
              {steps[step].name} with confidence
            </span>
            <div className="mk-sample-card">
              <span className="mk-sample-symbol">a.</span>
              <div>
                <h3>Amina Namusoke</h3>
                <p>Ideas worth sharing.</p>
              </div>
              <span>↗</span>
            </div>
            <div className="mk-workspace-lines">
              <span />
              <span />
              <span />
            </div>
            <div className="mk-workspace-status">
              ✓{" "}
              {step === 0
                ? "Private draft saved"
                : step === 1
                  ? "Your link is ready to share"
                  : "Published details updated"}
            </div>
          </div>
        </div>
      </section>
      <section className="mk-section">
        <div className="mk-section-heading">
          <div>
            <p className="mk-eyebrow">One studio. Different ways to connect.</p>
            <h2>
              Made for your kind
              <br />
              of introduction.
            </h2>
          </div>
          <Link className="mk-text-link" href="/pricing">
            Explore the plans ↗
          </Link>
        </div>
        <div className="mk-audiences">
          <Link href="/explore/individuals">
            <div className="mk-audience-graphic">
              <span>
                you<span>↗</span>
              </span>
            </div>
            <h3>
              For individuals <span>↗</span>
            </h3>
            <p>Your personality. Your work. Your next opportunity.</p>
          </Link>
          <Link href="/explore/teams">
            <div className="mk-audience-graphic team">
              <span>
                us<span>✳</span>
              </span>
            </div>
            <h3>
              For teams <span>↗</span>
            </h3>
            <p>Bring your group’s contacts into one shared space.</p>
          </Link>
        </div>
      </section>
      <section className="mk-section mk-faq">
        <div>
          <p className="mk-eyebrow">Good questions</p>
          <h2>
            Let’s clear
            <br />a few things up.
          </h2>
          <Link href="/explore/faq" className="mk-text-link">
            More answers ↗
          </Link>
        </div>
        <div>
          {[
            [
              "Do people need an app to see my card?",
              "No. Your published profile opens in their web browser.",
            ],
            [
              "Can I update a card after sharing it?",
              "Yes. Publish your changes and the same profile link shows the latest version. Downloaded offline codes remain a fixed snapshot.",
            ],
            [
              "Can I keep a card private?",
              "Yes. Save a private draft and publish only when you are ready. You can unpublish later.",
            ],
            [
              "Can I use Card Studio for a team?",
              "Yes. Group contact bundles let you share a reviewed roster with members’ permission.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="mk-final">
        <p className="mk-eyebrow">Your next connection is waiting</p>
        <h2>
          Start with a hello.
          <br />
          Make it <em>yours.</em>
        </h2>
        <Link href="/studio" className="mk-button">
          Create your card ↗
        </Link>
      </section>
    </main>
  );
}
