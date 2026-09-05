"use client";
export default function ErrorPage({reset}:{reset:()=>void}) {
  return <main className="max-w-lg mx-auto p-8"><h1 className="text-2xl mb-4">We couldn’t load this page</h1><p className="mb-4">Your saved cards have not been changed. Try again in a moment.</p><button className="cs-button cs-primary" onClick={reset}>Try again</button></main>;
}
