
import React from 'react';
import Logo from './icons/Logo';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <Logo />
        <h1 className="text-xl font-semibold text-gray-700">Intelligent Data Analyzer</h1>
      </div>
    </header>
  );
};

export default Header;
