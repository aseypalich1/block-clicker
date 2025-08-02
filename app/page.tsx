"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

// Enhanced block types with neon colors and effects
const blockTypes = [
  {
    color: "#00FF41",
    glowColor: "#00FF41",
    width: 100,
    height: 100,
    points: 1,
    name: "Matrix",
  },
  {
    color: "#FF0080",
    glowColor: "#FF0080",
    width: 70,
    height: 70,
    points: 3,
    name: "Cyber",
  },
  {
    color: "#00FFFF",
    glowColor: "#00FFFF",
    width: 50,
    height: 50,
    points: 5,
    name: "Neon",
  },
  {
    color: "#8A2BE2",
    glowColor: "#8A2BE2",
    width: 30,
    height: 30,
    points: 7,
    name: "Plasma",
  },
  {
    color: "#FFD700",
    glowColor: "#FFD700",
    width: 15,
    height: 15,
    points: 10,
    name: "Gold",
  },
]

interface Tile {
  id: number
  x: number
  y: number
  typeIndex: number
  scale: number
}

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
}

interface LeaderboardEntry {
  name: string
  score: number
  date: string
}

export default function FallingBlocksGame() {
  const [score, setScore] = useState(0)
  const [health, setHealth] = useState(10)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [particles, setParticles] = useState<Particle[]>([])
  const [isGameOver, setIsGameOver] = useState(false)
  const [combo, setCombo] = useState(0)
  const [showCombo, setShowCombo] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [playerName, setPlayerName] = useState("")
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [nameSubmitted, setNameSubmitted] = useState(false)
  const animationFrameRef = useRef<number>()
  const pendingTileTimeouts = useRef<NodeJS.Timeout[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Game settings
  const gameAreaWidth = 800
  const gameAreaHeight = 600
  const fallSpeed = 1.5
  const maxTilesOnScreen = 4

  // Load leaderboard from localStorage
  useEffect(() => {
    const savedLeaderboard = localStorage.getItem("blockClickerLeaderboard")
    if (savedLeaderboard) {
      setLeaderboard(JSON.parse(savedLeaderboard))
    }
  }, [])

  // Save leaderboard to localStorage
  const saveLeaderboard = (newLeaderboard: LeaderboardEntry[]) => {
    localStorage.setItem("blockClickerLeaderboard", JSON.stringify(newLeaderboard))
    setLeaderboard(newLeaderboard)
  }

  // Add score to leaderboard
  const addToLeaderboard = (name: string, finalScore: number) => {
    const newEntry: LeaderboardEntry = {
      name: name,
      score: finalScore,
      date: new Date().toLocaleDateString(),
    }

    const updatedLeaderboard = [...leaderboard, newEntry].sort((a, b) => b.score - a.score).slice(0, 10) // Keep only top 10

    saveLeaderboard(updatedLeaderboard)
    setNameSubmitted(true)
  }

  // Particle system
  const createParticles = (x: number, y: number, color: string, count = 8) => {
    const newParticles: Particle[] = []
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: Date.now() + Math.random(),
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10 - 5,
        life: 60,
        maxLife: 60,
        color: color,
      })
    }
    setParticles((prev) => [...prev, ...newParticles])
  }

  const updateParticles = () => {
    setParticles((prev) =>
      prev
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vy: particle.vy + 0.3, // gravity
          life: particle.life - 1,
        }))
        .filter((particle) => particle.life > 0),
    )
  }

  const createTile = () => {
    setTiles((prev) => {
      if (prev.length < maxTilesOnScreen) {
        return [...prev, createNewTile()]
      }
      return prev
    })
  }

  const scheduleMissingTiles = (currentCount: number) => {
    const tilesNeeded = maxTilesOnScreen - currentCount

    for (let i = 0; i < tilesNeeded; i++) {
      const timeout = setTimeout(
        () => {
          setTiles((prev) => {
            if (prev.length < maxTilesOnScreen) {
              return [...prev, createNewTile()]
            }
            return prev
          })
        },
        500 * (i + 1),
      )

      pendingTileTimeouts.current.push(timeout)
    }
  }

  const createNewTile = (): Tile => {
    const typeIndex = Math.floor(Math.random() * blockTypes.length)
    const block = blockTypes[typeIndex]
    return {
      id: Date.now() + Math.random(),
      x: Math.random() * (gameAreaWidth - block.width),
      y: Math.random() * 10,
      typeIndex: typeIndex,
      scale: 0.8 + Math.random() * 0.4,
    }
  }

  const clearPendingTimeouts = () => {
    pendingTileTimeouts.current.forEach((timeout) => clearTimeout(timeout))
    pendingTileTimeouts.current = []
  }

  const gameLoop = () => {
    if (isGameOver) return

    updateParticles()

    setTiles((prevTiles) => {
      const updatedTiles: Tile[] = []
      let tilesLost = 0

      prevTiles.forEach((tile) => {
        const block = blockTypes[tile.typeIndex]
        const newY = tile.y + fallSpeed

        if (newY > gameAreaHeight) {
          tilesLost++
          // Create explosion particles when tile is lost
          createParticles(tile.x + block.width / 2, gameAreaHeight, block.color, 5)
        } else {
          updatedTiles.push({
            ...tile,
            y: newY,
          })
        }
      })

      if (tilesLost > 0) {
        setHealth((h) => Math.max(0, h - tilesLost))
        setCombo(0) // Reset combo on missed tiles
        scheduleMissingTiles(updatedTiles.length)
      }

      return updatedTiles
    })

    animationFrameRef.current = requestAnimationFrame(gameLoop)
  }

  const handleTileClick = (tileId: number) => {
    const clickedTile = tiles.find((t) => t.id === tileId)
    if (clickedTile) {
      const block = blockTypes[clickedTile.typeIndex]
      const comboMultiplier = Math.floor(combo / 3) + 1
      const points = block.points * comboMultiplier

      setScore((s) => s + points)
      setCombo((c) => c + 1)
      setShowCombo(true)
      setTimeout(() => setShowCombo(false), 1000)

      // Create explosion particles
      createParticles(clickedTile.x + block.width / 2, clickedTile.y + block.height / 2, block.color, 12)

      setTiles((prev) => {
        const newTiles = prev.filter((t) => t.id !== tileId)

        if (newTiles.length < maxTilesOnScreen) {
          setTimeout(() => {
            createTile()
          }, 300)
        }

        return newTiles
      })
    }
  }

  const resetGame = () => {
    clearPendingTimeouts()
    setScore(0)
    setHealth(10)
    setTiles([])
    setParticles([])
    setCombo(0)
    setIsGameOver(false)
    setPlayerName("")
    setNameSubmitted(false)

    for (let i = 0; i < maxTilesOnScreen; i++) {
      setTimeout(() => {
        createTile()
      }, i * 300)
    }
  }

  // Canvas particle rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, gameAreaWidth, gameAreaHeight)

    particles.forEach((particle) => {
      const alpha = particle.life / particle.maxLife
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = particle.color
      ctx.shadowBlur = 10
      ctx.shadowColor = particle.color
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })
  }, [particles])

  useEffect(() => {
    if (!isGameOver) {
      animationFrameRef.current = requestAnimationFrame(gameLoop)
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isGameOver, particles])

  useEffect(() => {
    if (health <= 0) {
      setIsGameOver(true)
      clearPendingTimeouts()
    }
  }, [health])

  useEffect(() => {
    resetGame()
    return () => {
      clearPendingTimeouts()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Title */}
      <motion.h1
        className="text-6xl font-bold mb-8 bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        BLOCK CLICKER
      </motion.h1>

      {/* Stats */}
      <div className="flex gap-8 mb-6 text-2xl font-bold">
        <motion.div
          className="bg-black/50 backdrop-blur-sm border border-gray-700 rounded-lg px-6 py-3 text-gray-300 shadow-lg shadow-gray-900/20"
          whileHover={{ scale: 1.05 }}
        >
          <span className="text-gray-400">Score:</span> {score.toLocaleString()}
        </motion.div>

        <motion.div
          className="bg-black/50 backdrop-blur-sm border border-gray-700 rounded-lg px-6 py-3 text-gray-300 shadow-lg shadow-gray-900/20"
          whileHover={{ scale: 1.05 }}
        >
          <span className="text-gray-400">Health:</span> {health}
        </motion.div>

        <AnimatePresence>
          {combo > 2 && (
            <motion.div
              className="bg-black/50 backdrop-blur-sm border border-yellow-400/30 rounded-lg px-6 py-3 text-yellow-400 shadow-lg shadow-yellow-400/20"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: showCombo ? 1.2 : 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span className="text-yellow-300">Combo:</span> {combo}x
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Game Area */}
      <div className="relative">
        <div
          className="relative bg-black/30 backdrop-blur-sm border-2 border-gray-700 rounded-xl overflow-hidden shadow-2xl shadow-gray-900/20"
          style={{ width: gameAreaWidth, height: gameAreaHeight }}
        >
          {/* Particle canvas */}
          <canvas
            ref={canvasRef}
            width={gameAreaWidth}
            height={gameAreaHeight}
            className="absolute inset-0 pointer-events-none z-10"
          />

          {/* Game Over Screen */}
          <AnimatePresence>
            {isGameOver && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.h2
                  className="text-6xl font-bold text-red-400 mb-4"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                >
                  GAME OVER
                </motion.h2>
                <motion.p
                  className="text-2xl text-gray-300 mb-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  Final Score: {score.toLocaleString()}
                </motion.p>

                {/* Name input for leaderboard */}
                {!nameSubmitted && (
                  <motion.div
                    className="mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    <input
                      type="text"
                      placeholder="Enter your name"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 mr-2"
                      maxLength={20}
                    />
                    <button
                      onClick={() => addToLeaderboard(playerName || "Anonymous", score)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
                    >
                      Submit
                    </button>
                  </motion.div>
                )}

                <div className="flex gap-4">
                  <motion.button
                    onClick={resetGame}
                    className="px-8 py-4 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-700 rounded-lg text-xl font-semibold text-white shadow-lg shadow-gray-900/30 transition-all duration-300 hover:scale-105"
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8, type: "spring" }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    PLAY AGAIN
                  </motion.button>

                  <motion.button
                    onClick={() => setShowLeaderboard(!showLeaderboard)}
                    className="px-8 py-4 bg-black/50 backdrop-blur-sm border border-gray-700 rounded-lg text-xl font-semibold text-gray-300 hover:text-white hover:border-gray-600 transition-all duration-300"
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1, type: "spring" }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    LEADERBOARD
                  </motion.button>
                </div>

                {/* Leaderboard */}
                <AnimatePresence>
                  {showLeaderboard && (
                    <motion.div
                      className="mt-6 bg-black/70 backdrop-blur-sm border border-gray-700 rounded-lg p-6 max-w-md w-full"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                    >
                      <h3 className="text-xl font-bold text-gray-300 mb-4 text-center">Top Players</h3>
                      {leaderboard.length > 0 ? (
                        <div className="space-y-2">
                          {leaderboard.map((entry, index) => (
                            <div key={index} className="flex justify-between items-center text-white">
                              <span className="text-gray-400 font-bold">#{index + 1}</span>
                              <span className="flex-1 mx-3 truncate">{entry.name}</span>
                              <span className="font-mono">{entry.score.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-center">No scores yet!</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Falling Blocks */}
          <AnimatePresence>
            {tiles.map((tile) => {
              const block = blockTypes[tile.typeIndex]
              return (
                <motion.div
                  key={tile.id}
                  onClick={() => handleTileClick(tile.id)}
                  className="absolute cursor-pointer select-none"
                  style={{
                    left: tile.x,
                    top: tile.y,
                    width: block.width,
                    height: block.height,
                  }}
                  initial={{ scale: 0 }}
                  animate={{
                    scale: tile.scale,
                  }}
                  exit={{ scale: 0 }}
                  whileHover={{ scale: tile.scale * 1.1 }}
                  whileTap={{ scale: tile.scale * 0.9 }}
                >
                  <div
                    className="w-full h-full rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center text-2xl font-bold"
                    style={{
                      backgroundColor: block.color,
                      boxShadow: `0 0 20px ${block.glowColor}40, inset 0 0 20px ${block.glowColor}20`,
                      border: `2px solid ${block.glowColor}80`,
                    }}
                  ></div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Rules & Leaderboard Buttons */}
      <motion.div
        className="mt-6 flex flex-col items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <div className="flex gap-4">
          <button
            onClick={() => setShowRules(!showRules)}
            className="px-6 py-3 bg-black/50 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:border-gray-600 transition-all duration-300"
          >
            Rules & Info
          </button>

          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="px-6 py-3 bg-black/50 backdrop-blur-sm border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:border-gray-600 transition-all duration-300"
          >
            Leaderboard
          </button>
        </div>

        <AnimatePresence>
          {showRules && (
            <motion.div
              className="bg-black/70 backdrop-blur-sm border border-gray-700 rounded-lg p-6 max-w-2xl text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <h3 className="text-xl font-bold text-gray-300 mb-4">How to Play</h3>
              <p className="text-white mb-4">
                Click on the tiles, earn points. Oh yeah, you have 10 lives.
                <br />
                Good luck!
              </p>

              {/* Block Points */}
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-gray-300 mb-2">Block Values</h4>
                <div className="flex gap-4 flex-wrap justify-center">
                  {blockTypes.map((block, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10"
                    >
                      <div
                        className="w-6 h-6 rounded"
                        style={{
                          backgroundColor: block.color,
                          boxShadow: `0 0 10px ${block.glowColor}40`,
                        }}
                      />
                      <span className="text-white text-sm font-medium">{block.points}pts</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-sm text-gray-400 border-t border-gray-700 pt-4">
                <p>Fork of the original "Кликалка" game</p>
                <p>
                  Developed by{" "}
                  <a
                    href="https://vk.com/ehot_ha_dpakohe"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 hover:text-white underline transition-colors"
                  >
                    Vadim Ponomaryov
                  </a>{" "}
                  in C++
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showLeaderboard && !isGameOver && (
            <motion.div
              className="bg-black/70 backdrop-blur-sm border border-gray-700 rounded-lg p-6 max-w-md w-full"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <h3 className="text-xl font-bold text-gray-300 mb-4 text-center">Top Players</h3>
              {leaderboard.length > 0 ? (
                <div className="space-y-2">
                  {leaderboard.map((entry, index) => (
                    <div key={index} className="flex justify-between items-center text-white">
                      <span className="text-gray-400 font-bold">#{index + 1}</span>
                      <span className="flex-1 mx-3 truncate">{entry.name}</span>
                      <span className="font-mono">{entry.score.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center">No scores yet!</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
