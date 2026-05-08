import React from 'react';
import { C } from '../theme.js';

export default function Divider({ my = 12 }) {
  return <div style={{ height: 1, background: C.border, margin: `${my}px 0` }} />;
}
