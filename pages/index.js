import Head from "next/head";
import { useAuth } from '../contexts/AuthContext';
import AuthForm from '../components/AuthForm';
import Dashboard from '../components/Dashboard';

export default function Home() {
  const { user, loading } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <>
        <Head>
          <title>Link Saver - AI-Powered Bookmark Manager</title>
          <meta name="description" content="Save and organize your favorite links with AI-powered summaries" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <div className="text-lg text-gray-600">Loading...</div>
          </div>
        </div>
      </>
    );
  }

  // Show main app
  return (
    <>
      <Head>
        <title>Link Saver - AI-Powered Bookmark Manager</title>
        <meta name="description" content="Save and organize your favorite links with AI-powered summaries" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {user ? <Dashboard /> : <AuthForm />}
    </>
  );
}
