import React, { createContext } from 'react';
import { useSocket } from '../../contexts/SocketContext';

export const KitchenLocalContext = createContext(null);

const KitchenSocketProvider = ({ children }) => {
  const { socket } = useSocket() || { socket: null };

  return (
    <KitchenLocalContext.Provider value={{ socket }}>
      {children}
    </KitchenLocalContext.Provider>
  );
};

export default KitchenSocketProvider;
