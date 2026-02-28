import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

export default function NotFoundPage() {
  return (
    <AuthLayout>
      <h1 className="text-[26px] font-normal text-[#1a1f2e] mb-2" style={{ fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.01em' }}>
        Page not found
      </h1>
      <p className="text-sm text-[#8a96ae] font-light mb-8 leading-relaxed">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="inline-block w-full py-3.5 text-center text-[15px] font-medium text-white rounded-[7px] no-underline transition-all hover:opacity-90"
        style={{ background: '#2d3a52' }}
      >
        Go to home
      </Link>
      <p className="mt-6 text-center text-sm text-[#8a96ae]">
        <Link to="/login" className="text-[#2d3a52] font-medium no-underline border-b border-transparent hover:border-[#2d3a52] transition-[border-color]">
          Sign in
        </Link>
        {' · '}
        <Link to="/register" className="text-[#2d3a52] font-medium no-underline border-b border-transparent hover:border-[#2d3a52] transition-[border-color]">
          Register
        </Link>
      </p>
    </AuthLayout>
  );
}
