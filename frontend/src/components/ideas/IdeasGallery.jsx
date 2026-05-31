import React from 'react'
import { motion } from 'framer-motion'
import IdeaCard from './IdeaCard'

export default function IdeasGallery({ ideas, onRefresh }) {
  return (
    <div>
      {ideas.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 text-nexo-muted text-sm"
        >
          Nenhuma ideia encontrada
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {ideas.map((idea, i) => (
            <motion.div
              key={idea.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              <IdeaCard idea={idea} variant="full" />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
