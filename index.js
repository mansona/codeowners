#!/usr/bin/env node
// @ts-check
'use strict';

const findUp = require('find-up');
const fs = require('fs');
const ignore = require('ignore');
const maxBy = require('lodash.maxby');
const padEnd = require('lodash.padend');
const intersection = require('lodash.intersection');
const path = require('path');
const program = require('commander');

const Codeowners = require('./codeowners.js');

// https://stackoverflow.com/a/5827895
function walk(dir, excludedFiles, done) {
  let results = [];
  fs.readdir(dir, (err, list) => {

    if (err) return done(err);
    list = list.filter(file => !excludedFiles.includes(file));
    let pending = list.length;
    if (!pending) return done(null, results);

    list.forEach(file => {
      file = path.resolve(dir, file);
      fs.stat(file, (err, stat) => {
        if (stat && stat.isDirectory()) {
          walk(file, excludedFiles, (err, res) => {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

// TODO make a command-line option, and find .git
const rootPath = process.cwd();

const gitignorePath = findUp.sync('.gitignore', { cwd: rootPath });
const gitignoreMatcher = ignore();

if (gitignorePath) {
  gitignoreMatcher.add(fs.readFileSync(gitignorePath).toString());
}

program
  .command('audit')
  .description('list the owners for all files')
  .option('-u, --unowned', 'unowned files only')
  .option('-c, --codeowners-filename <codeowners_filename>', 'specify CODEOWNERS filename', "CODEOWNERS")
  .action(options => {
    const codeowners = new Codeowners(rootPath, options.codeOwnersFilename);

    walk(rootPath, ['.git', 'node_modules'], (err, files) => {
      if (err) {
        console.error(err);

        process.exit(1);
      }

      files.sort();

      const relativeFiles = files.map(file => path.relative(codeowners.codeownersDirectory, file));
      const filteredFiles = relativeFiles.filter(gitignoreMatcher.createFilter()).sort();
      const maxLength = maxBy(filteredFiles, file => file.length).length;

      filteredFiles.forEach(file => {
        let owners = codeowners.getOwner(file);
        if (options.unowned) {
          if (!owners.length) {
            return console.log(file);
          }
        } else {
          let printedOwner = 'nobody';
          if (owners.length) {
            printedOwner = owners.join(' ');
          }
          console.log(`${padEnd(file, maxLength)}    ${printedOwner}`);
        }
      });
    });
  });

program
  .command("verify <path>")
  .description("verify ownership of a specific path")
  .requiredOption('-u, --users <users...>', 'verify ownership by these users or teams')
  .option('-c, --codeowners-filename <codeowners_filename>', 'specify CODEOWNERS filename', "CODEOWNERS")
  .action((path, options) => {
    // instantiate new Codeowners obj
    const codeowners = new Codeowners(rootPath, options.codeOwnersFilename);

    // call getOwner() on `path`
    const owners = codeowners.getOwner(path);

    // check if any `users` are in the results of getOwner()
    const verifiedOwners = intersection(options.users, owners);

    // if verifiedOwners is empty, exit with error
    if (verifiedOwners.length < 1) {
      console.log(`None of the users/teams specified own the path ${path}`);
      process.exit(1);
    }

    // print owners
    for (let currOwner of verifiedOwners) {
      console.log(`${path}    ${currOwner}`);
    }
  });

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse(process.argv);
