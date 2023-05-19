// Required modules
const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cookieSession = require("cookie-session");
const bcrypt = require("bcrypt");

// Create Express app
const app = express();
const PORT = 8080; // default port 8080

// Middleware setup
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cookieSession({
    name: "session",
    keys: ["Brady"],
    maxAge: 24 * 60 * 60 * 1000,
  })
);

// User and URL databases
const users = {
  userRandomID: {
    id: "userRandomID",
    email: "user@example.com",
    password: "purple-monkey-dinosaur",
  },
  user2RandomID: {
    id: "user2RandomID",
    email: "user2@example.com",
    password: "dishwasher-funk",
  },
};

const urlDatabase = {
  b6UTxQ: {
    longURL: "https://www.tsn.ca",
    userID: "aJ48lW",
  },
  i3BoGr: {
    longURL: "https://www.google.ca",
    userID: "aJ48lW",
  },
};

// Helper functions

// Generates a random alphanumeric string
function generateRandomString() {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Returns true if the given email exists in the user database
const emailHasUser = function (email, userDatabase) {
  for (const user in userDatabase) {
    if (userDatabase[user].email === email) {
      return true;
    }
  }
  return false;
};

// Returns the user ID associated with the given email
const userIdFromEmail = function (email, userDatabase) {
  for (const user in userDatabase) {
    if (userDatabase[user].email === email) {
      return userDatabase[user].id;
    }
  }
};

// Returns the user object associated with the given email
const getUserByEmail = (email, users) => {
  for (const userId in users) {
    const user = users[userId];
    if (user.email === email) {
      return user;
    }
  }
  return null;
};

// Returns an object containing URLs belonging to the given user ID
const urlsForUser = function (id, urlDatabase) {
  const userUrls = {};
  for (const shortURL in urlDatabase) {
    if (urlDatabase[shortURL].userID === id) {
      userUrls[shortURL] = urlDatabase[shortURL];
    }
  }
  return userUrls;
};

// Returns true if the given long URL exists in the URL database
const urlExists = function (longURL, urlDatabase) {
  for (const shortURL in urlDatabase) {
    if (urlDatabase[shortURL].longURL === longURL) {
      return true;
    }
  }
  return false;
};

// Returns true if the given cookie value corresponds to a user in the user database
const cookieHasUser = function (cookie, userDatabase) {
  for (const user in userDatabase) {
    if (cookie === user) {
      return true;
    }
  }
  return false;
};

// Routes

// Home page
app.get("/", (req, res) => {
  if (cookieHasUser(req.session.user_id, users)) {
    res.redirect("/urls");
  } else {
    res.redirect("/login");
  }
});

// URL list page
app.get("/urls", (req, res) => {
  if (!req.session.user_id) {
    res.status(401).render("error", { message: "Please log in to access this page." });
    return;
  } 
  
  let templateVars = {
    urls: urlsForUser(req.session.user_id, urlDatabase),
    user: users[req.session.user_id],
  };
  res.render("urls_index", templateVars);
});

// Create new URL page
app.get("/urls/new", (req, res) => {
  if (!cookieHasUser(req.session.user_id, users)) {
    res.redirect("/login");
  } else {
    let templateVars = {
      user: users[req.session.user_id],
    };
    res.render("urls_new", templateVars);
  }
});

// User registration page
app.get("/register", (req, res) => {
  if (cookieHasUser(req.session.user_id, users)) {
    res.redirect("/urls");
  } else {
    let templateVars = {
      user: users[req.session.user_id],
    };
    res.render("urls_registration", templateVars);
  }
});

// User login page
app.get("/login", (req, res) => {
  if (cookieHasUser(req.session.user_id, users)) {
    res.redirect("/urls");
  } else {
    let templateVars = {
      user: users[req.session.user_id],
    };
    res.render("urls_login", templateVars);
  }
});

// URL details page
app.get("/urls/:shortURL", (req, res) => {
  if (!req.session.user_id) {
    res.status(401).render("error", { message: "Please log in to access this page." });
    return;
  }

  const shortURL = req.params.shortURL;
  const url = urlDatabase[shortURL];
  
  if (!url) {
    res.status(404).render("error", { message: "The short URL you entered does not correspond with a long URL at this time." });
    return;
  }

  if (url.userID !== req.session.user_id) {
    res.status(403).render("error", { message: "You are not authorized to access this URL." });
    return;
  }

  let templateVars = {
    shortURL: shortURL,
    longURL: url.longURL,
    urlUserID: url.userID,
    user: users[req.session.user_id],
  };
  res.render("urls_show", templateVars);
});

// Redirect to long URL
app.get("/u/:shortURL", (req, res) => {
  if (urlDatabase[req.params.shortURL]) {
    const longURL = urlDatabase[req.params.shortURL].longURL;
    if (longURL === undefined) {
      res.status(302);
    } else {
      res.redirect(longURL);
    }
  } else {
    res
      .status(404)
      .send(
        "The short URL you are trying to access does not correspond with a long URL at this time."
      );
  }
});

// Create new URL
app.post("/urls", (req, res) => {
  const longURL = req.body.longURL;
  if (urlExists(longURL, urlDatabase)) {
    res.status(400).send("URL already exists");
    return;
  }
  if (req.session.user_id) {
    const shortURL = generateRandomString();
    urlDatabase[shortURL] = {
      longURL: req.body.longURL,
      userID: req.session.user_id,
    };

    res.redirect(`/urls/${shortURL}`);
  } else {
    res
      .status(401)
      .send("You must be logged in to a valid account to create short URLs.");
  }
});

// User registration
app.post("/register", (req, res) => {
  const submittedEmail = req.body.email;
  const submittedPassword = req.body.password;

  if (!submittedEmail || !submittedPassword) {
    res.status(400).send("Please include both a valid email and password");
  } else if (emailHasUser(submittedEmail, users)) {
    res.status(400).send("An account already exists for this email address");
  } else {
    const newUserID = generateRandomString();
    users[newUserID] = {
      id: newUserID,
      email: submittedEmail,
      password: bcrypt.hashSync(submittedPassword, 10),
    };
    req.session.user_id = newUserID;
    res.redirect("/urls");
  }
});

// User login
app.post("/login", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  if (!emailHasUser(email, users)) {
    res
      .status(403)
      .send("There is no account associated with this email address");
  } else {
    const userID = userIdFromEmail(email, users);
    if (!bcrypt.compareSync(password, users[userID].password)) {
      res
        .status(403)
        .send(
          "The password you entered does not match the one associated with the provided email address"
        );
    } else {
      req.session.user_id = userID;
      res.redirect("/urls");
    }
  }
});

// User logout
app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/login");
});

// Delete URL
app.post("/urls/:shortURL/delete", (req, res) => {
  const userID = req.session.user_id;
  const userUrls = urlsForUser(userID, urlDatabase);
  if (Object.keys(userUrls).includes(req.params.shortURL)) {
    const shortURL = req.params.shortURL;
    delete urlDatabase[shortURL];
    res.redirect("/urls");
  } else {
    res
      .status(401)
      .send("You do not have authorization to delete this short URL.");
  }
});

// Update URL
app.post("/urls/:id", (req, res) => {
  const userId = req.session.user_id;
  if (!userId) {
    res.status(401).render("error", { message: "Please log in to access this page." });
    return;
  }

  const { id } = req.params;
  const { newLongURL } = req.body;

  if (!urlDatabase[id] || urlDatabase[id].userID !== userId) {
    res.status(403).render("error", { message: "You are not authorized to modify this URL." });
    return;
  }

  urlDatabase[id].longURL = newLongURL;
  res.redirect("/urls");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});
