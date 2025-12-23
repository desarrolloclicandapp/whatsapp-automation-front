// src/hooks/useSocket.js
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const API_URL = (import.meta.env.VITE_API_URL || "https://wa.clicandapp.com").replace(/\/$/, "");

let socket;

export const useSocket = () => {
    if (!socket) {
        socket = io(API_URL, {
            transports: ['websocket'],
            reconnection: true,
        });
    }
    return socket;
};