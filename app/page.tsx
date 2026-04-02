import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center py-32 px-16 sm:items-start">
        <h1 className="text-2xl text-slate-300">Capstone 826 Pasado</h1>
        <Link href="/login" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          Go to Login Page
        </Link>
        <Link href="/test" className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mt-4">Go to test page</Link>
        <Link href="/test/operations" className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded mt-4">Go to Operations test page</Link>
        <Link href="/test/technician" className="bg-emerald-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded mt-4">Go to Technician test page</Link>
        <Link href="/test/head-technician" className="bg-purple-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded mt-4">Go to Head Technician test page</Link>
        <Link href="/test/admin" className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded mt-4">Go to Admin test page</Link>
      </main>
    </div>
  );  
}
