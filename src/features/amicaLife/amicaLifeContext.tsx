// Minimal stub for legacy compatibility after amicaLife removal
import { createContext } from 'react';

// Stub AmicaLife class for compatibility
class AmicaLifeStub {
  public checkSettingOff(_: boolean): void {}
  public initialize(..._args: any[]): void {}
}

export const amicaLifeStub = new AmicaLifeStub();

export const AmicaLifeContext = createContext<{ amicaLife: AmicaLifeStub }>({
  amicaLife: amicaLifeStub,
});

export function AmicaLifeProvider({ children }: { children: React.ReactNode }) {
  return (
    <AmicaLifeContext.Provider value={{ amicaLife: amicaLifeStub }}>
      {children}
    </AmicaLifeContext.Provider>
  );
}
