# Mongodb Migration Tool

This tool should be used to migrate your database migration from one state to another

It uses a changlog file in xml format to describe the change operation to be performed.

## Getting Started

To run migration run the following command

```bash
migtool migrates
```

This should run the migration to the last migration file

To rollback the migration run the following command

```bash
migtool rollback
```
