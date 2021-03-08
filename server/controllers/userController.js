const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { roles } = require('../roles');

async function hashPassword(pwd) {
  return await bcrypt.hash(pwd, 10);
}

async function validatePassword(pwd, hashedPwd) {
  return await bcrypt.compare(pwd, hashedPwd);
}

exports.signup = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    const hashedPassword = await hashPassword(password);
    const newUser = new User({ email, password: hashedPassword, role: role || 'basic' });
    const accessToken = jwt.sign(
      { userId: newUser._id }, // 用户id存入token
      process.env.JWT_SECRET, // salt 加盐
      {
        expiresIn: '1d', // token时效
      }
    );
    newUser.accessToken = accessToken;
    await newUser.save();
    res.json({
      data: newUser,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    // 获取邮箱和密码
    const { email, password } = req.body;
    // 判断用户是否存在
    const user = await User.findOne({ email });
    if (!user) {
      return next(new Error('邮箱不存在'));
    }
    // 密码校验
    const validPassword = await validatePassword(password, user.password);
    if (!validPassword) {
      return next(new Error('密码不正确'));
    }
    const accessToken = jwt.sign(
      { userId: user._id }, // 用户id存入token
      process.env.JWT_SECRET, // salt 加盐
      {
        expiresIn: '1d', // token时效
      }
    );
    await User.findByIdAndUpdate(user._id, { accessToken });
    res.status(200).json({
      data: { email: user.email, role: user.role },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find({});
    res.status(200).json({
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    if (!user) {
      return next(new Error('用户不存在'));
    }
    res.status(200).json({
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const update = req.body;
    const userId = req.params.userId;
    await User.findByIdAndUpdate(userId, update);
    const user = await User.findById(userId);
    res.status(200).json({
      data: user,
      message: '用户更新成功',
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await User.findByIdAndDelete(userId);
    res.status(200).json({
      data: null,
      message: '用户删除成功',
    });
  } catch (error) {
    next(error);
  }
};

exports.grantAccess = function (action, resource) {
  return async (req, res, next) => {
    try {
      const permission = roles.can(req.user.role)[action](resource);
      if (!permission.granted) {
        return res.status(401).json({
          error: '您没有权限执行此操作',
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

exports.allowIfLoggedIn = async (req, res, next) => {
  try {
    const user = res.locals.loggedInUser;
    if (!user) {
      return res.status(401).json({
        error: '请先登录',
      });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
