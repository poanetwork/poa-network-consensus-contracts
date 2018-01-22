var fs = require('fs');

function readFiles(dirname, onFileContent, onError) {
  fs.readdir(dirname, function(err, filenames) {
    if (err) {
      onError(err);
      return;
    }
    filenames.forEach(function(filename) {
      fs.readFile(dirname + filename, 'utf-8', function(err, content) {
        if (err) {
          onError(err);
          return;
        }
        onFileContent(filename, content);
      });
    });
  });
}

let dir = '../build/contracts/';
readFiles(dir, function(filename, content) {
	if (filename.includes(".abi.")) return;
	let abi = JSON.stringify(JSON.parse(content).abi, null, 2);
	let abiFileName = `${dir}${filename}.abi.json`;
	fs.writeFileSync(abiFileName, abi);
}, function(err) {
  throw err;
});