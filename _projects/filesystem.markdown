---
layout: project
title: Ubuntu Virtual File System
snippet: A Terminal-Based filesystem for managing a virtual volume

tools_used:
    - c
    - pthreads

project_url: https://github.com/CSC415-2024-Spring/csc415-filesystem-eliasmagdaleno
---

This project involved taking a volume (represented by a large file on disk) and implementing a file system with support for files, directories, and operations on them such as creating, moving, and deleting. 

Being built in plain c using nothing but the standard C library along with the occasional pthread and UNIX-specific call, almost all of the memory management and file operations are implemented without reliance on external libraries besides the UNIX standard.