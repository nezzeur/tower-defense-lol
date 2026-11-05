import type { EnemyDef } from '../types';

export const ENEMIES: Record<string, EnemyDef> = {
  melee: { id: 'melee', name: 'Sbire mêlée', hp: 12, speed: 1.2, armor: 0, gold: 2, leak: 1, size: 9, color: '#e05555', shape: 'circle' },
  caster: { id: 'caster', name: 'Sbire lanceur', hp: 9, speed: 1.25, armor: 0, gold: 2, leak: 1, size: 8, color: '#c86dd7', shape: 'circle' },
  cannon: { id: 'cannon', name: 'Sbire canon', hp: 30, speed: 0.9, armor: 0.15, gold: 5, leak: 2, size: 12, color: '#b0563a', shape: 'square' },
  super: { id: 'super', name: 'Super sbire', hp: 60, speed: 0.85, armor: 0.25, gold: 8, leak: 3, size: 14, color: '#8a1c1c', shape: 'square' },
  scuttle: { id: 'scuttle', name: 'Carapateur', hp: 8, speed: 2.4, armor: 0, gold: 3, leak: 1, size: 9, color: '#4fd1c5', shape: 'diamond' },
  // Jungle camps mixed into the waves
  wolf: { id: 'wolf', name: 'Loup des ombres', hp: 14, speed: 1.6, armor: 0, gold: 3, leak: 1, size: 9, color: '#5b5f7a', shape: 'circle' },
  raptor: { id: 'raptor', name: 'Raptor', hp: 7, speed: 1.9, armor: 0, gold: 2, leak: 1, size: 7, color: '#d9534f', shape: 'circle' },
  krug: { id: 'krug', name: 'Krug', hp: 70, speed: 0.65, armor: 0.3, gold: 9, leak: 2, size: 12, color: '#8a7f73', shape: 'square' },
  gromp: { id: 'gromp', name: 'Gromp', hp: 110, speed: 0.75, armor: 0.1, gold: 14, leak: 3, size: 14, color: '#5fa86a', shape: 'square' },
  drake: { id: 'drake', name: 'Drake infernal', hp: 250, speed: 0.7, armor: 0.15, gold: 40, leak: 5, size: 17, color: '#ff6b35', shape: 'boss' },
  herald: { id: 'herald', name: 'Larve du Néant', hp: 400, speed: 0.6, armor: 0.15, gold: 60, leak: 5, size: 17, color: '#8e44ad', shape: 'boss' },

  // Final bosses: reaching the nexus costs 12 lives and they walk the lane again.
  riftherald: { id: 'riftherald', name: 'Héraut de la Faille', hp: 900, speed: 0.45, armor: 0.2, gold: 200, leak: 12, size: 22, color: '#7d3cff', boss: true, shape: 'boss' },
  baron: { id: 'baron', name: 'Baron Nashor', hp: 1000, speed: 0.45, armor: 0.2, gold: 250, leak: 12, size: 24, color: '#6a1b9a', boss: true, shape: 'boss' },
  poroking: { id: 'poroking', name: 'Roi Poro', hp: 1000, speed: 0.5, armor: 0.2, gold: 250, leak: 12, size: 24, color: '#f0f0f0', boss: true, shape: 'boss' },
  colossus: { id: 'colossus', name: 'Colosse de glace', hp: 1100, speed: 0.4, armor: 0.25, gold: 300, leak: 12, size: 24, color: '#8fd3ff', boss: true, shape: 'boss' },
  sentinel: { id: 'sentinel', name: 'Sentinelle de Shurima', hp: 1200, speed: 0.4, armor: 0.25, gold: 350, leak: 12, size: 24, color: '#d4a537', boss: true, shape: 'boss' },
  fallenking: { id: 'fallenking', name: 'Spectre du Roi déchu', hp: 1300, speed: 0.42, armor: 0.25, gold: 400, leak: 12, size: 25, color: '#3dd6a3', boss: true, shape: 'boss' },
  petricite: { id: 'petricite', name: 'Golem de pétricite', hp: 1150, speed: 0.42, armor: 0.25, gold: 280, leak: 12, size: 24, color: '#e6e9f0', boss: true, shape: 'boss' },
  warbeast: { id: 'warbeast', name: 'Bête de guerre noxienne', hp: 1250, speed: 0.45, armor: 0.25, gold: 320, leak: 12, size: 24, color: '#8a1c2a', boss: true, shape: 'boss' },
  spiritguard: { id: 'spiritguard', name: 'Gardien spirituel', hp: 1350, speed: 0.45, armor: 0.2, gold: 340, leak: 12, size: 24, color: '#ff9ed2', boss: true, shape: 'boss' },
  automaton: { id: 'automaton', name: 'Automate hextech', hp: 1450, speed: 0.4, armor: 0.3, gold: 380, leak: 12, size: 24, color: '#c9a35a', boss: true, shape: 'boss' },
};
