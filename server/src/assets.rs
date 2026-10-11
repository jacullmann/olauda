//! Files members upload: task attachments, their previews and group pictures.
//!
//! Every file passes through the server, which recognises it by its content,
//! enforces the size limits and only then stores it in Cloudinary under an ID
//! of its choosing. Each stored file is recorded before it is uploaded, and a
//! periodic sweep deletes recorded files that nothing references anymore, so
//! deleting a task, replacing a group picture or abandoning an upload needs no
//! cleanup code of its own.

pub mod dto;
pub mod file_kind;
pub mod handlers;
pub mod routes;
pub mod service;
pub mod sweep;
