const sql = `
  CREATE TRIGGER IF NOT EXISTS notes_fts_ai AFTER INSERT ON note_content 
  BEGIN 
    INSERT INTO notes_fts(id, title, preview, content) 
    SELECT new.id, m.title, m.preview, new.content 
    FROM note_metadata m WHERE m.id = new.id; 
  END;
`;
const split = sql.split(";").map(s => s.trim()).filter(s => s.length > 0).map(s => s + ";");
console.log(split);
