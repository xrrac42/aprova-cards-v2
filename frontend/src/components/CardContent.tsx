import React from 'react';
import { decodeHtmlEntities } from '@/lib/html-entities';

interface CardContentProps {
  text: string;
  className?: string;
}

const CardContent: React.FC<CardContentProps> = ({ text, className }) => {
  const decoded = decodeHtmlEntities(text);
  const lines = decoded.split('\n');
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </span>
  );
};

export default CardContent;
