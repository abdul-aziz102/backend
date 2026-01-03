import asyncHandler from 'express-async-handler';
import Task from '../models/Task.js';

// @desc    Get all tasks for user
// @route   GET /api/tasks
// @access  Private
export const getTasks = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Build filter object
  const filter = { user: req.user._id };

  // Search by title/description
  if (req.query.search) {
    filter.$or = [
      { title: { $regex: req.query.search, $options: 'i' } },
      { description: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  // Filter by status
  if (req.query.status && req.query.status !== 'all') {
    filter.status = req.query.status;
  }

  // Filter by priority
  if (req.query.priority && req.query.priority !== 'all') {
    filter.priority = req.query.priority;
  }

  // Build sort object
  let sort = { createdAt: -1 }; // Default: newest first
  if (req.query.sortBy) {
    const sortField = req.query.sortBy;
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    sort = { [sortField]: sortOrder };
  }

  const total = await Task.countDocuments(filter);
  const tasks = await Task.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit);

  res.json({
    tasks,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalTasks: total
  });
});

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
export const getTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  // Make sure user owns the task
  if (task.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to access this task');
  }

  res.json(task);
});

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private
export const createTask = asyncHandler(async (req, res) => {
  const { title, description, priority, dueDate } = req.body;

  if (!title) {
    res.status(400);
    throw new Error('Please add a title');
  }

  const task = await Task.create({
    user: req.user._id,
    title,
    description,
    priority,
    dueDate
  });

  res.status(201).json(task);
});

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  // Make sure user owns the task
  if (task.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to update this task');
  }

  const { title, description, status, priority, dueDate } = req.body;

  const updatedTask = await Task.findByIdAndUpdate(
    req.params.id,
    {
      title: title || task.title,
      description: description !== undefined ? description : task.description,
      status: status || task.status,
      priority: priority || task.priority,
      dueDate: dueDate !== undefined ? dueDate : task.dueDate,
      updatedAt: Date.now()
    },
    { new: true, runValidators: true }
  );

  res.json(updatedTask);
});

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  // Make sure user owns the task
  if (task.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to delete this task');
  }

  await Task.findByIdAndDelete(req.params.id);

  res.json({ message: 'Task removed' });
});

// @desc    Toggle task status
// @route   PATCH /api/tasks/:id/toggle
// @access  Private
export const toggleTaskStatus = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  // Make sure user owns the task
  if (task.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to update this task');
  }

  task.status = task.status === 'pending' ? 'completed' : 'pending';
  task.updatedAt = Date.now();

  await task.save();

  res.json(task);
});

// @desc    Get task statistics
// @route   GET /api/tasks/stats
// @access  Private
export const getTaskStats = asyncHandler(async (req, res) => {
  const stats = await Task.aggregate([
    { $match: { user: req.user._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const totalTasks = await Task.countDocuments({ user: req.user._id });

  res.json({
    total: totalTasks,
    pending: stats.find(s => s._id === 'pending')?.count || 0,
    completed: stats.find(s => s._id === 'completed')?.count || 0
  });
});
