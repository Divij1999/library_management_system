const Book = require("../models/book");
const Author = require("../models/author");
const Genre = require("../models/genre");
const BookInstance = require("../models/bookinstance");
const { body, validationResult } = require("express-validator");

const async = require("async");

exports.index = (req, res) => {
  async.parallel(
    {
      book_count(callback) {
        Book.countDocuments({}).then((res) => {
          callback(null, res);
        });
        // Pass an empty object as match condition to find all documents of this collection
      },
      book_instance_count(callback) {
        BookInstance.countDocuments({}).then((res) => {
          callback(null, res);
        });
      },
      book_instance_available_count(callback) {
        BookInstance.countDocuments({ status: "Available" }).then((res) => {
          callback(null, res);
        });
      },
      author_count(callback) {
        Author.countDocuments({}).then((res) => {
          callback(null, res);
        });
      },
      genre_count(callback) {
        Genre.countDocuments({}).then((res) => {
          callback(null, res);
        });
      },
    },
    (err, results) => {
      console.log(results);
      res.render("index", {
        title: "Local Library Home",
        error: err,
        data: results,
      });
    }
  );
};

// Display list of all books.

exports.book_list = function (req, res, next) {
  Book.find({}, "title author")
    .sort({ title: 1 })
    .populate("author")
    .then(function (list_books) {
      //Successful, so render
      res.render("book_list", { title: "Book List", book_list: list_books });
    })
    .catch((err) => {
      if (err) {
        return next(err);
      }
    });
};

// Display detail page for a specific book.
exports.book_detail = (req, res, next) => {
  async.parallel(
    {
      book(callback) {
        Book.findById(req.params.id)
          .populate("author")
          .populate("genre")
          .then((res) => callback(null, res));
      },
      book_instance(callback) {
        BookInstance.find({ book: req.params.id }).then((res) =>
          callback(null, res)
        );
      },
    },
    (err, results) => {
      if (err) {
        return next(err);
      }
      if (results.book == null) {
        // No results.
        const err = new Error("Book not found");
        err.status = 404;
        return next(err);
      }
      // Successful, so render.
      res.render("book_detail", {
        title: results.book.title,
        book: results.book,
        book_instances: results.book_instance,
      });
    }
  );
};

// Display book create form on GET.
exports.book_create_get = (req, res, next) => {
  // Get all authors and genres, which we can use for adding to our book.
  async.parallel(
    {
      authors(callback) {
        Author.find().then((authors) => callback(null, authors));
      },
      genres(callback) {
        Genre.find().then((genres) => callback(null, genres));
      },
    },
    (err, results) => {
      if (err) {
        return next(err);
      }
      res.render("book_form", {
        title: "Create Book",
        authors: results.authors,
        genres: results.genres,
      });
    }
  );
};

// Handle book create on POST.
exports.book_create_post = [
  // Convert the genre to an array.
  (req, res, next) => {
    if (!Array.isArray(req.body.genre)) {
      req.body.genre =
        typeof req.body.genre === "undefined" ? [] : [req.body.genre];
    }
    next();
  },

  // Validate and sanitize fields.
  body("title", "Title must not be empty.")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("author", "Author must not be empty.")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("summary", "Summary must not be empty.")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("isbn", "ISBN must not be empty").trim().isLength({ min: 1 }).escape(),
  body("genre.*").escape(),

  // Process request after validation and sanitization.
  (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    // Create a Book object with escaped and trimmed data.
    const book = new Book({
      title: req.body.title,
      author: req.body.author,
      summary: req.body.summary,
      isbn: req.body.isbn,
      genre: req.body.genre,
    });

    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.

      // Get all authors and genres for form.
      async.parallel(
        {
          authors(callback) {
            Author.find().then((authors) => callback(null, authors));
          },
          genres(callback) {
            Genre.find().then((genres) => callback(null, genres));
          },
        },
        (err, results) => {
          if (err) {
            return next(err);
          }

          // Mark our selected genres as checked.
          for (const genre of results.genres) {
            if (book.genre.includes(genre._id)) {
              genre.checked = "true";
            }
          }
          res.render("book_form", {
            title: "Create Book",
            authors: results.authors,
            genres: results.genres,
            book,
            errors: errors.array(),
          });
        }
      );
      return;
    }

    // Data from form is valid. Save book.
    book.save((err) => {
      if (err) {
        return next(err);
      }
      // Successful: redirect to new book record.
      res.redirect(book.url);
    });
  },
];

// Display book delete form on GET.
exports.book_delete_get = (req, res, next) => {
  async.parallel(
    {
      book(callback) {
        Book.findById(req.params.id).then((book) => callback(null, book));
      },

      book_instances(callback) {
        BookInstance.find({ book: req.params.id }).then((instances) =>
          callback(null, instances)
        );
      },
    },
    (err, results) => {
      if (err) {
        return next(err);
      }

      if (results.book === null) {
        res.redirect("/catalog/books");
      }
      // If the book exists
      res.render("book_delete", {
        title: "Delete Book",
        book: results.book,
        book_instances: results.book_instances,
      });
    }
  );
};

// Handle book delete on POST.
exports.book_delete_post = (req, res, next) => {
  Book.findByIdAndRemove(req.body.bookid)
    .then(() => {
      res.redirect("/catalog/books");
    })
    .catch((err) => next(err));
};

// Display book update form on GET.
exports.book_update_get = (req, res, next) => {
  // Get book, authors and genres for form.
  async.parallel(
    {
      book(callback) {
        Book.findById(req.params.id)
          .populate("author")
          .populate("genre")
          .then((book) => callback(null, book));
      },
      authors(callback) {
        Author.find().then((author) => callback(null, author));
      },
      genres(callback) {
        Genre.find().then((genres) => callback(null, genres));
      },
    },
    (err, results) => {
      if (err) {
        return next(err);
      }
      if (results.book == null) {
        // No results.
        const err = new Error("Book not found");
        err.status = 404;
        return next(err);
      }
      // Success.
      // Mark our selected genres as checked.
      for (const genre of results.genres) {
        for (const bookGenre of results.book.genre) {
          if (genre._id.toString() === bookGenre._id.toString()) {
            genre.checked = "true";
          }
        }
      }
      res.render("book_form", {
        title: "Update Book",
        authors: results.authors,
        genres: results.genres,
        book: results.book,
      });
    }
  );
};

// Handle book update on POST.
exports.book_update_post = [
  // Convert the genre to an array
  (req, res, next) => {
    if (!Array.isArray(req.body.genre)) {
      req.body.genre =
        typeof req.body.genre === "undefined" ? [] : [req.body.genre];
    }
    next();
  },

  // Validate and sanitize fields.
  body("title", "Title must not be empty.")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("author", "Author must not be empty.")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("summary", "Summary must not be empty.")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("isbn", "ISBN must not be empty").trim().isLength({ min: 1 }).escape(),
  body("genre.*").escape(),

  // Process request after validation and sanitization.
  (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    // Create a Book object with escaped/trimmed data and old id.
    const book = new Book({
      title: req.body.title,
      author: req.body.author,
      summary: req.body.summary,
      isbn: req.body.isbn,
      genre: typeof req.body.genre === "undefined" ? [] : req.body.genre,
      _id: req.params.id, //This is required, or a new ID will be assigned!
    });

    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.

      // Get all authors and genres for form.
      async.parallel(
        {
          authors(callback) {
            Author.find().then((author) => callback(null, author));
          },
          genres(callback) {
            Genre.find().then((genres) => callback(null, genres));
          },
        },
        (err, results) => {
          if (err) {
            return next(err);
          }

          // Mark our selected genres as checked.
          for (const genre of results.genres) {
            if (book.genre.includes(genre._id)) {
              genre.checked = "true";
            }
          }
          res.render("book_form", {
            title: "Update Book",
            authors: results.authors,
            genres: results.genres,
            book,
            errors: errors.array(),
          });
        }
      );
      return;
    }

    // Data from form is valid. Update the record.
    Book.findByIdAndUpdate(req.params.id, book, {})
      .then((thebook) => {
        // Successful: redirect to book detail page.
        res.redirect(thebook.url);
      })
      .catch((err) => {
        console.log(err);
      });
  },
];
