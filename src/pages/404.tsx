import Link from "next/link";
import Head from "next/head";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 - Page Not Found | Niya</title>
      </Head>
      <div className="min-h-screen niya-room-bg flex flex-col items-center justify-center text-gray-800 p-6">
        <div className="text-center max-w-md">
          <h1 className="text-8xl font-bold mb-4">404</h1>
          <p className="text-2xl font-semibold mb-2">Page Not Found</p>
          <p className="text-gray-600 mb-8">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-full font-bold hover:bg-amber-600 transition-colors"
            data-testid="link-back-home"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to Home
          </Link>
        </div>
      </div>
    </>
  );
}
