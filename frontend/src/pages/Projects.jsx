import React, { useState, useEffect } from 'react';
import ProjectCard from '../components/ProjectCard';
import { Plus, Search } from 'lucide-react';

export default function Projects({ onOpenProject }) {
  const [projects, setProjects] = useState([
    {
      id: 'proj_1',
      name: 'Knight Animation Pack',
      sprite_count: 24,
      resolution: '64x64',
      last_updated: '2026-11-04',
      status: 'ready'
    },
    {
      id: 'proj_2',
      name: 'Monster Slime Walk & Attack',
      sprite_count: 16,
      resolution: '32x32',
      last_updated: '2026-11-03',
      status: 'in_progress'
    },
    {
      id: 'proj_3',
      name: 'Pixel Hero Character Set',
      sprite_count: 48,
      resolution: '48x48',
      last_updated: '2026-11-01',
      status: 'ready'
    }
  ]);
  const [search, setSearch] = useState('');

  // Tải dữ liệu từ backend FastAPI nếu backend đang chạy
  useEffect(() => {
    fetch('/api/projects')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.data) {
          setProjects(data.data);
        }
      })
      .catch(() => {
        // Fallback dùng mock data nếu backend chưa bật
      });
  }, []);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Tìm kiếm dự án..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '34px', width: '100%' }}
          />
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Tổng cộng: <strong>{filtered.length}</strong> dự án
        </div>
      </div>

      <div className="cards-grid">
        {filtered.map((proj) => (
          <ProjectCard key={proj.id} project={proj} onOpen={onOpenProject} />
        ))}
      </div>
    </div>
  );
}
