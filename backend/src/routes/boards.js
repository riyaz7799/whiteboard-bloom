const express = require('express');
const { pool } = require('../db');
const router = express.Router();

function isAuthenticated(req, res, next) {
  if (req.user) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// GET /api/boards — list all boards for logged-in user
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id as "boardId", updated_at as "updatedAt"
       FROM boards WHERE owner_id = $1
       ORDER BY updated_at DESC`,
      [req.user.id]
    );
    res.json({ boards: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// POST /api/boards — create new empty board
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `INSERT INTO boards (owner_id, objects, pages)
       VALUES ($1, $2, $3) RETURNING id`,
      [req.user.id, JSON.stringify([]), JSON.stringify([])]
    );
    res.status(201).json({ boardId: rows[0].id });
  } catch (err) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO boards (owner_id, objects) VALUES ($1, $2) RETURNING id`,
        [req.user.id, JSON.stringify([])]
      );
      res.status(201).json({ boardId: rows[0].id });
    } catch (err2) {
      console.error(err2);
      res.status(500).json({ error: 'Failed to create board' });
    }
  }
});

// POST /api/boards/:boardId — save board
router.post('/:boardId', isAuthenticated, async (req, res) => {
  try {
    const { boardId } = req.params;
    const { objects, pages, boardName } = req.body;

    try {
      await pool.query(
        `UPDATE boards
         SET objects = $1, pages = $2, board_name = $3, updated_at = NOW()
         WHERE id = $4 AND owner_id = $5`,
        [
          JSON.stringify(objects || (pages && pages[0]?.objects) || []),
          JSON.stringify(pages || []),
          boardName || 'Untitled Board',
          boardId,
          req.user.id,
        ]
      );
    } catch {
      const allObjects = pages
        ? pages.flatMap((p) => p.objects || [])
        : (objects || []);
      await pool.query(
        `UPDATE boards SET objects = $1, updated_at = NOW() WHERE id = $2 AND owner_id = $3`,
        [JSON.stringify(allObjects), boardId, req.user.id]
      );
    }

    res.json({ success: true, boardId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save board' });
  }
});

// GET /api/boards/:boardId — load board
// ✅ Returns ownerId so frontend auto-detects who is host — NO F12 needed ever again
router.get('/:boardId', isAuthenticated, async (req, res) => {
  try {
    const { boardId } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM boards WHERE id = $1',
      [boardId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Board not found' });

    const b = rows[0];

    const pages = b.pages && b.pages.length > 0
      ? b.pages
      : [{ id: 'page-1', name: 'Page 1', objects: b.objects || [] }];

    res.json({
      boardId:   b.id,
      ownerId:   b.owner_id,    // ✅ THE KEY FIX — frontend compares this with logged-in user
      objects:   b.objects  || [],
      pages,
      boardName: b.board_name || 'Untitled Board',
      updatedAt: b.updated_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load board' });
  }
});

// DELETE /api/boards/:boardId — delete a board
router.delete('/:boardId', isAuthenticated, async (req, res) => {
  try {
    const { boardId } = req.params;
    const { rowCount } = await pool.query(
      'DELETE FROM boards WHERE id = $1 AND owner_id = $2',
      [boardId, req.user.id]
    );
    if (rowCount === 0)
      return res.status(404).json({ error: 'Board not found or not authorized' });
    res.json({ success: true, boardId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete board' });
  }
});

module.exports = router;