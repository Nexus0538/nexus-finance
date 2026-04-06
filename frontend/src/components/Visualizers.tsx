import React, { useEffect, useRef } from 'react';

export const SwarmVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const agents = [
      { x: 0.2, y: 0.5, color: '#00e5ff', label: 'ARIA', vx: (Math.random() * 0.006 - 0.003), vy: (Math.random() * 0.006 - 0.003) },
      { x: 0.5, y: 0.3, color: '#00ff9d', label: 'DELTA', vx: (Math.random() * 0.006 - 0.003), vy: (Math.random() * 0.006 - 0.003) },
      { x: 0.7, y: 0.6, color: '#a855f7', label: 'SIGMA', vx: (Math.random() * 0.006 - 0.003), vy: (Math.random() * 0.006 - 0.003) },
      { x: 0.4, y: 0.7, color: '#ff6b00', label: 'KAPPA', vx: (Math.random() * 0.006 - 0.003), vy: (Math.random() * 0.006 - 0.003) },
    ];

    let frame = 0;
    let animationId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw connections
      for (let i = 0; i < agents.length; i++) {
        for (let j = i + 1; j < agents.length; j++) {
          const a = agents[i];
          const b = agents[j];
          const ax = a.x * canvas.width;
          const ay = a.y * canvas.height;
          const bx = b.x * canvas.width;
          const by = b.y * canvas.height;
          const d = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
          
          ctx.strokeStyle = `rgba(0, 229, 255, ${Math.max(0, 0.2 - d / 500)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }

      agents.forEach(a => {
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < 0.05 || a.x > 0.95) a.vx *= -1;
        if (a.y < 0.05 || a.y > 0.95) a.vy *= -1;
        
        const x = a.x * canvas.width;
        const y = a.y * canvas.height;
        const pulse = Math.sin(frame * 0.05) * 3;
        
        ctx.beginPath();
        ctx.arc(x, y, 12 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = a.color + '18';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = a.color + '40';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = a.color;
        ctx.fill();
        
        ctx.fillStyle = a.color;
        ctx.font = '8px "Share Tech Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(a.label, x, y + 20);
      });
      
      frame++;
      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return <canvas ref={canvasRef} width={500} height={160} className="w-full h-full" />;
};

export const NeuralVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const layers = [4, 6, 5, 3, 2];
    const nodes: any[] = [];
    const lw = canvas.width;
    const lh = canvas.height;
    const layerCount = layers.length;

    layers.forEach((nodeCount, li) => {
      const x = 40 + li * (lw - 80) / (layerCount - 1);
      for (let ni = 0; ni < nodeCount; ni++) {
        const y = lh / 2 - ((nodeCount - 1) * 22) / 2 + ni * 22;
        nodes.push({ x, y, li, ni, active: Math.random() > 0.4 });
      }
    });

    let animationId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update activity
      if (Math.random() > 0.9) {
        nodes.forEach(n => n.active = Math.random() > 0.4);
      }

      // Draw connections
      nodes.forEach(n => {
        nodes.filter(n2 => n2.li === n.li + 1).forEach(n2 => {
          ctx.strokeStyle = n.active ? `rgba(0, 229, 255, 0.12)` : `rgba(20, 45, 70, 0.6)`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.stroke();
        });
      });

      // Draw nodes
      nodes.forEach(n => {
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 8);
        if (n.active) {
          grad.addColorStop(0, 'rgba(0, 255, 157, 0.9)');
          grad.addColorStop(1, 'rgba(0, 255, 157, 0)');
        } else {
          grad.addColorStop(0, 'rgba(0, 229, 255, 0.4)');
          grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
        }
        
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = n.active ? '#00ff9d' : 'rgba(0, 229, 255, 0.3)';
        ctx.fill();
        
        if (n.active) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, 8, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      });

      // Layer labels
      ['INPUT', 'ENCODE', 'DECIDE', 'ROUTE', 'OUTPUT'].forEach((l, i) => {
        const x = 40 + i * (lw - 80) / (layerCount - 1);
        ctx.fillStyle = 'rgba(42, 69, 96, 0.8)';
        ctx.font = '8px "Share Tech Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(l, x, lh - 4);
      });

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return <canvas ref={canvasRef} width={400} height={160} className="w-full h-full" />;
};

export const RiskHeatmap: React.FC = () => {
  return (
    <div className="grid grid-cols-8 gap-1">
      {Array.from({ length: 64 }).map((_, i) => {
        const risk = Math.random();
        const hue = risk < 0.33 ? 120 : risk < 0.66 ? 40 : 0;
        const sat = 100;
        const light = risk < 0.33 ? 38 : risk < 0.66 ? 45 : 38;
        return (
          <div 
            key={i} 
            className="aspect-square rounded-sm cursor-pointer transition-transform hover:scale-110" 
            style={{ 
              backgroundColor: `hsla(${hue}, ${sat}%, ${light}%, 0.7)`,
              boxShadow: `inset 0 0 0 1px hsla(${hue}, ${sat}%, ${light + 10}%, 0.3)`
            }}
            title={`Risk: ${(risk * 100).toFixed(0)}%`}
          />
        );
      })}
    </div>
  );
};
